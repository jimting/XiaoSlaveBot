// Database's setting
var mysql  = require('mysql');
var db_server = process.env.db_server;
var db_user = process.env.db_user;
var db_passwd = process.env.db_passwd;
var db_name = process.env.db_name;
var crawler_url = process.env.crawler_url;

//for rabbitmq
var MQserver = process.env.rabbitmq;
var rabbitmq = require('rabbit.js').createContext(MQserver);


module.exports = function(robot) 
{
	//主動下搜尋關鍵字指令，ifNotify=True
    robot.respond(/(搜尋)(.*)/, function(response) 
    {
		//拿到關鍵字
		var keywords = response.match[2]; 
		
		//設定好搜尋的url
		var url = crawler_url + '/shopeeCrawler?keywords='+keywords;
		var encoded_url = encodeURI(url);
		
		response.reply("好的！開始搜尋「"+keywords+"」！");
		
		//開始搜尋惹
		var request = require('request');
		var room = response.envelope.room;
		request(encoded_url, function(error, res, body) 
		{
			if (!error && res.statusCode == 200) 
			{
				json_data = JSON.parse(body.replace('"', '\"').replace("'", "\'"));
				// 將拿到的最新結果進行分析與儲存，並將有更動的資料加到MessageQueue上。
				response.reply("總共搜尋到"+json_data.length+"筆商品資料。")
				analyseSearchResult(json_data, keywords);
			}
			if(error)
			{
				response.reply("搜尋中出了點錯誤！\n"+error);
				// end the flow
			}
		});
    });
	
	//加入一筆資料到追蹤清單中，並觸發背景deepSearch取得當下最新資料存到Database當中
	robot.respond(/(追蹤)\s(.*)/, function(response) 
    {
		//拿到關鍵字
		var keywords = response.match[2]; 
		//拿到房間號碼
		var room = response.envelope.room;
		
		response.reply("追蹤「"+keywords+"」成功！之後每個整點將會為你查詢最新商品與任何價格變動趨勢。");
		
		//將追蹤動作加到資料庫的schedule之中
		addSchedule(room, keywords);
    });
	
	//嗯？就列出清單，有問題嗎？
	robot.respond(/(追蹤清單)/, function(response) 
    {
		//拿到房間號碼
		var room = response.envelope.room;
		
		response.reply("以下為此聊天室中的所有追蹤清單：");
		
		//拿到所有schedule，並列出。
		schedules = getSchedule(room, robot);
		
    });
	
	//就把一筆追蹤資料刪除，很簡單的。
	robot.respond(/(取消追蹤)\s(.*)/, function(response) 
    {
		//拿到關鍵字
		var keywords = response.match[2]; 
		//拿到房間號碼
		var room = response.envelope.room;
		
		//我直接就不爽了 把他刪掉
		deleteSchedule(room, keywords);
		
		response.reply("取消追蹤「"+keywords+"」成功。");
		
		
    });
}

//新增一筆資料到追蹤清單中
function addSchedule(room, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name
	}); 
	 
	connection.connect();
	 
	var  addSql = 'INSERT INTO schedule(room, keyword) VALUES(?, ?)';
	var  addSqlParams = [room, keywords];
	// 新增Schedule內容
	connection.query(addSql,addSqlParams,function (err, result) {
		if(err)
		{
			console.log('[INSERT ERROR] - ',err.message);
			return;
		}        
	 
		console.log('--------------------------INSERT----------------------------');
		//console.log('INSERT ID:',result.insertId);        
		console.log('INSERT ID:',result);        
		console.log('-----------------------------------------------------------------\n\n');  
	});
	 
	connection.end();
}

//拿到追蹤清單
function getSchedule(room, robot)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var sql = 'SELECT * FROM schedule where room='+room;
	//查尋指令
	connection.query(sql,function (err, result) {
		if(err)
		{
			console.log('[SELECT ERROR] - ',err.message);
			return;
		}
		 
		console.log('--------------------------SELECT----------------------------');
		console.log(result);
		console.log('------------------------------------------------------------\n\n');  
		var json_data = JSON.parse(JSON.stringify(result));
		console.log(json_data);
		var schedules = "";
		for(var i = 0;i < json_data.length; i++)
		{
			schedules += json_data[i].keyword + "\n";
		}
		robot.messageRoom(room, schedules);
	});
	 
	connection.end();
}

//把一筆追蹤資料刪掉
function deleteSchedule(room, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var delSql = 'DELETE FROM schedule where room="' + room + '" and keyword="' + keywords + '"';
	//查尋指令
	connection.query(delSql,function (err, result) {
		if(err)
		{
			console.log('[DELETE ERROR] - ',err.message);
			return;
		}
		 
		console.log('--------------------------DELETE----------------------------');
		console.log('DELETE affectedRows',result.affectedRows);
		console.log('-----------------------------------------------------------------\n\n'); 
	});
	 
	connection.end();
}

//把查到的結果丟去新增，如果新增失敗就更新(代表裡面已經有這筆資料惹)
async function analyseSearchResult(data_json, keywords)
{
	for (i in data_json) 
	{
		var itemExistStatus = await ifItemExist(data_json[i].link)
		await new Promise(r => setTimeout(r, 50));
		if(itemExistStatus)
		{
			console.log("=====正在將第"+i+"筆資料寫入資料庫=====");
			await newItem(data_json[i], keywords);
			itemInsertNotify(data_json[i]);
		}
		else
		{
			console.log("=====正在將第"+i+"筆資料更新進資料庫=====");
			await updateItem(data_json[i], keywords);
			itemUpdateNotify(data_json[i]);
		}
		await new Promise(r => setTimeout(r, 50));
	} 
}
//檢查Item是否在資料庫裡了，以link來判斷。
function ifItemExist(link)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var sql = 'SELECT * FROM item where link='+link;
	//查尋指令
	connection.query(sql,function (err, result) {
		if(err)
		{
			console.log('[SELECT ERROR] - ',err.message);
			return false;
		}
		 
		console.log('--------------------------SELECT----------------------------');
		console.log(result);
		console.log('------------------------------------------------------------\n\n');  
		var json_data = JSON.parse(JSON.stringify(result));
		if(json_data.length > 0)
			return true;
		return false;
	});
	connection.end();
}

//新增Item物件
function newItem(item_json, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name
	}); 
	 
	connection.connect();

	var  addSql = 'INSERT INTO item(name, link, img, sales_volume, price, monthly_revenue, review, ad) VALUES(?, ?, ?, ?, ?, ?, ?, ?)';
	var  addSqlParams = [item_json.name, item_json.link, item_json.img, item_json.sales_volume, item_json.price, item_json.monthly_revenue, item_json.review, item_json.ad];
	// 新增Schedule內容
	connection.query(addSql,addSqlParams,function (err, result) {
		if(err)
		{
			console.log('[INSERT ERROR] - ',err.message);
			return;
		}        
		
		console.log('--------------------------INSERT----------------------------');
		//console.log('INSERT ID:',result.insertId);        
		console.log('INSERT ID:',result);        
		console.log('-----------------------------------------------------------------\n\n');  
	});
	 
	connection.end();
	newKeywords(item_json, keywords);
}

//更新Item物件
function updateItem(item_json, keywords)
{
	console.log("將此Json寫入資料庫："+item_json);
	
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var modSql = 'UPDATE item SET name=?, img=?, sales_volume=?, price=?, monthly_revenue=?, review=?, ad=?';
	var modSqlParams = [item_json.name, item_json.img, item_json.sales_volume, item_json.price, item_json.monthly_revenue, item_json.review, item_json.ad];
	//查尋指令
	connection.query(modSql,function (err, result) {
		if(err)
		{
			//console.log('[UPDATE ERROR] - ',err.message);
			return;
		}
		 
		console.log('--------------------------UPDATE----------------------------');
		console.log('UPDATE affectedRows',result.affectedRows);
		console.log('-----------------------------------------------------------------\n\n'); 
	});
	 
	connection.end();
}

//新增物件Keyword
function newKeywords(item_json, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: '3306',                   
		database: db_name
	}); 
	 
	connection.connect();

	var  addSql = 'INSERT INTO keyword(link, keyword) VALUES(?, ?)';
	var  addSqlParams = [item_json.link, keywords];
	// 新增Schedule內容
	connection.query(addSql,addSqlParams,function (err, result) {
		if(err)
		{
			console.log('[INSERT ERROR] - ',err.message);
			return;
		}        
		
		console.log('--------------------------INSERT----------------------------');
		//console.log('INSERT ID:',result.insertId);        
		console.log('INSERT Keywords Successfully:',result);        
		console.log('-----------------------------------------------------------------\n\n');  
	});
	 
	connection.end();
}

//推通知訊息到MessageQueue
function itemUpdateNotify(item_json)
{
	var pub = rabbitmq.socket('PUBLISH');
	pub.connect('itemUpdate', function() 
	{
		item_json.keyword = 
		pub.write(JSON.stringify(item_json), "utf-8");
	});
}

//推通知訊息到MessageQueue
function itemInsertNotify(item_json)
{
	var pub = rabbitmq.socket('PUBLISH');
	pub.connect('itemInsert', function() 
	{
		pub.write(JSON.stringify(item_json), "utf-8");
	});
}