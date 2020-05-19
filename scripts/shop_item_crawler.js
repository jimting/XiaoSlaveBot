// Database's setting
var mysql  = require('mysql');
var db_server = process.env.db_server;
var db_port = process.env.db_port;
var db_user = process.env.db_user;
var db_passwd = process.env.db_passwd;
var db_name = process.env.db_name;
var crawler_url = process.env.crawler_url;

//for rabbitmq
var MQserver = process.env.rabbitmq;
var rabbitmq = require('rabbit.js').createContext(MQserver);

//cron job
var cron = require("node-cron");
var cron_keyword_list = [];
var cronjob;

//request
var request = require('request');

module.exports = function(robot) 
{
	//主動下搜尋關鍵字指令，ifNotify=True
    robot.respond(/(搜尋)\s(.*)/, function(response) 
    {
		//拿到關鍵字
		var keywords = response.match[2]; 
		
		response.reply("好的！開始搜尋「"+keywords+"」！\n若有新商品將會通知。(無通知即是無變更資訊)");
		shopeeCrawler(keywords);
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
		addSchedule(robot, room, keywords);
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
		deleteSchedule(robot, room, keywords);
		
		response.reply("取消追蹤「"+keywords+"」成功。");
		
		
    });

	followItemsCronJob(robot);
}

//新增一筆資料到追蹤清單中
function addSchedule(robot, room, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
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
		
		//reset cronjob
		cronjob.stop();
		followItemsCronJob(robot);
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
		port: db_port,                   
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
function deleteSchedule(robot, room, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
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
		
		//reset cronjob
		cronjob.stop();
		followItemsCronJob(robot);
	});
	 
	connection.end();
}

function shopeeCrawler(keywords)
{
	//設定好搜尋的url
	var url = crawler_url + '/shopeeCrawler?keywords='+keywords;
	var encoded_url = encodeURI(url);
	
	//開始搜尋惹
	request(encoded_url, function(error, res, body) 
	{
		if (!error && res.statusCode == 200) 
		{
			json_data = JSON.parse(body);
			// 將拿到的最新結果進行分析與儲存，並將有更動的資料加到MessageQueue上。
			analyseSearchResult(json_data, keywords);
		}
	});
}

//分析爬蟲爬到的結果，並把每筆資料丟進去跑！
async function analyseSearchResult(data_json, keywords)
{
	for (i in data_json) 
	{
		//每一筆確認都是獨立的，先把空白url過濾掉(不知為啥會有"https://shopee.tw/"這個link...)
		if(data_json[i].link != "https://shopee.tw/")
			await ifItemExist(data_json[i], keywords);
	} 
}

async function checkFunction(item_json, keywords, itemExistStatus)
{
	if(itemExistStatus == "NOT_EXIST")
	{
		console.log("=====開始插入=====");
		await newItem(item_json, keywords);
		await itemInsertNotify(item_json, keywords);
	}
	else if(itemExistStatus == "UPDATE")
	{
		console.log("=====開始更新=====");
		await updateItem(item_json, keywords);
		await itemUpdateNotify(item_json, keywords);
	}
	await new Promise(r => setTimeout(r, 50));
}

//檢查Item是否在資料庫裡了，以link來判斷。
async function ifItemExist(item_json, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var sql = 'SELECT * FROM item where link="'+item_json.link+'"';
	//查尋指令
	connection.query(sql,function (err, result) {
		var itemExistStatus = "NOT_EXIST";
		if(err)
		{
			console.log('[SELECT ERROR] - ',err.message);
			itemExistStatus = "NOT_EXIST";
		}
		 
		console.log('-----檢查Item是否在資料庫裡了，以link來判斷。-----');
		console.log(result);  
		try{
			var json_data = JSON.parse(JSON.stringify(result));
			if(json_data.length > 0)
				itemExistStatus = "EXIST";
			
			//若有在資料庫內，檢查是否有更動。
			if(itemExistStatus=="EXIST")
			{
				//如果不同
				if(json_data[0].price!=item_json.price)
				{
					itemExistStatus = "UPDATE";
				}
				else //相同就不要做事情！
				{
					itemExistStatus = "DO_NOTHING";
				}
			}
		}
		catch(e){
			itemExistStatus = "DO_NOTHING";
		}
		console.log("檢查完成。Item資料庫動作：" + itemExistStatus);
		
		console.log('--------------------------End Check-------------------------------\n\n');
		checkFunction(item_json, keywords, itemExistStatus);
		ifKeywordExist(item_json, keywords);
	});
	connection.end();
}

//新增Item物件
async function newItem(item_json, keywords)
{
	console.log("寫入資料庫："+JSON.stringify(item_json));
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name
	}); 
	 
	connection.connect();

	var  addSql = 'INSERT INTO item(name, link, img, price, sales_volume, review, ad) VALUES(?, ?, ?, ?, ?, ?, ?)';
	var  addSqlParams = [item_json.name, item_json.link, item_json.img, item_json.price, item_json.sales_volume, item_json.review, item_json.ad];
	// 新增Schedule內容
	await connection.query(addSql,addSqlParams,function (err, result) {
		if(err)
		{
			console.log('[INSERT ERROR] - ',err.message);
			return;
		}        
		
		console.log('--------------------------新增Item物件----------------------------');
		//console.log('INSERT ID:',result.insertId);        
		console.log('INSERT ID:',result);        
		console.log('--------------------------End Insert------------------------------\n\n');  
	});
	connection.end();
}

//更新Item物件
async function updateItem(item_json, keywords)
{
	console.log("更新資料庫："+JSON.stringify(item_json));
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var modSql = 'UPDATE item SET name=?, img=?, price=?, sales_volume=?, review=?, ad=? where link=?';
	var modSqlParams = [item_json.name, item_json.img, item_json.price, item_json.sales_volume, item_json.review, item_json.ad, item_json.link];
	//查尋指令
	await connection.query(modSql, modSqlParams,function (err, result) {
		if(err)
		{
			//console.log('[UPDATE ERROR] - ',err.message);
			return;
		}
		 
		console.log('--------------------------更新Item物件----------------------------');
		console.log('UPDATE affectedRows',result.affectedRows);
		console.log('-------------------------End Update------------------------------\n\n'); 
	});
	 
	connection.end();
}

//檢查此Item是否包含此Keyword，若沒有就加進去。
async function ifKeywordExist(item_json, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var sql = 'SELECT * FROM keyword where link="'+item_json.link+'" and keyword="'+keywords+'"';
	//查尋指令
	connection.query(sql,function (err, result) {
		var itemExistStatus = true;
		if(err)
		{
			console.log('[SELECT ERROR] - ',err.message);
			itemExistStatus = false;
		}
		 
		console.log('---檢查此Item是否包含此Keyword，若沒有就加進去。---');
		console.log(result);  
		try{
			var json_data = JSON.parse(JSON.stringify(result));
			if(json_data.length == 0)
			{
				newKeywords(item_json, keywords);
			}
			else
			{
				itemExistStatus = false;
			}
		}
		catch(e){
			itemExistStatus = false;
			newKeywords(item_json, keywords);
		}
		console.log("檢查完成。是否在資料庫內？：" + itemExistStatus);
		console.log('--------------------------End Check-------------------------------\n\n');
	});
	connection.end();
}

//新增物件Keyword
async function newKeywords(item_json, keywords)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name
	}); 
	 
	connection.connect();

	var  addSql = 'INSERT INTO keyword(link, keyword) VALUES(?, ?)';
	var  addSqlParams = [item_json.link, keywords];
	// 新增Schedule內容
	await connection.query(addSql,addSqlParams,function (err, result) {
		if(err)
		{
			console.log('[INSERT ERROR] - ',err.message);
			return;
		}        
		
		console.log('--------------------------新增物件Keyword----------------------------');
		//console.log('INSERT ID:',result.insertId);        
		console.log('INSERT Keywords Successfully:',result);        
		console.log('---------------------------End Insert-------------------------\n\n');  
	});
	 
	connection.end();
}

//推通知訊息到MessageQueue
async function itemUpdateNotify(item_json, keywords)
{
	console.log("### 觸發item更新通知 ###");
	var pub = rabbitmq.socket('PUBLISH');
	pub.setsockopt('expiration', 5 * 1000);
	item_json.keywords = keywords;
	await pub.connect('itemUpdate', function() 
	{
		pub.write(JSON.stringify(item_json), "utf-8");
	});
}

//推通知訊息到MessageQueue
async function itemInsertNotify(item_json, keywords)
{
	console.log("### 觸發itemt插入通知 ###");
	var pub = rabbitmq.socket('PUBLISH');
	pub.setsockopt('expiration', 5 * 1000);
	item_json.keywords = keywords;
	await pub.connect('itemInsert', function() 
	{
		pub.write(JSON.stringify(item_json), "utf-8");
	});
}

//cronjob
function followItemsCronJob(robot)
{
	//先拿到所有的schedule
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var sql = 'SELECT DISTINCT keyword FROM schedule';
	//查尋指令
	connection.query(sql,function (err, result) {
		if(err)
		{
			console.log('[SELECT ERROR] - ',err.message);
			return;
		}
		 
		console.log('----查詢所有的關鍵字，每個整點送出查詢。----');
		var json_data = JSON.parse(JSON.stringify(result));
		console.log(json_data);
		
		cron_keyword_list = [];
		for(var i = 0;i < json_data.length; i++)
		{
			var keyword = json_data[i].keyword;
			cron_keyword_list.push(keyword);
		}
		
		cronjob = cron.schedule("00 40 * * * *", function(){
				
			startCronSearch(robot, cron_keyword_list, 0);
		});
		console.log('------------------------------------------------------------\n\n');  
	});
	 
	connection.end();
}

function startCronSearch(robot, cron_keyword_list, k) {
  setTimeout(function() {
    console.log("---------------------");
	console.log("Running Cron Job, keyword : " + cron_keyword_list[k]);
	robot.messageRoom("831516917", Date.now()+" | 開始查詢！關鍵字："+cron_keyword_list[k]);
	shopeeCrawler(cron_keyword_list[k]); 
    if (k < cron_keyword_list.length) {           
      myLoop(robot, cron_keyword_list, k+1); 
    }
  }, 5000)
}