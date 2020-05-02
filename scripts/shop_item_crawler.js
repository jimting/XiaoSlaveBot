// Database's setting
var mysql  = require('mysql');
var db_server = process.env.db_server;
var db_user = process.env.db_user;
var db_passwd = process.env.db_passwd;
var db_name = process.env.db_name;

module.exports = function(robot) 
{
    robot.respond(/(搜尋)(.*)/, function(response) 
    {
		//拿到關鍵字
		var keywords = response.match[2]; 
		
		//設定好搜尋的url
		var url = process.env.rootURL + ':4101/shopeeCrawler?keywords='+keywords;
		var encoded_url = encodeURI(url);
		
		response.reply("好的！開始搜尋「"+keywords+"」！");
		
		//開始搜尋惹
		var request = require('request');
		var room = response.envelope.room;
		request(encoded_url, function(error, res, body) 
		{
			if (!error && res.statusCode == 200) 
			{
				// 將拿到的最新結果進行分析與儲存，並回覆有更動的資料
				var result = analyseResult(body);
				for(var i = 0;i < result.length; i++)
				{
					robot.messageRoom(room, body);
				}
				//var json_data = JSON.parse((body[0].text));
				console.log(room);
			}
			if(error)
			{
				response.reply("搜尋中出了點錯誤！\n"+error);
				// end the flow
			}
		});
    });
	
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
	
	robot.respond(/(追蹤清單)/, function(response) 
    {
		//拿到房間號碼
		var room = response.envelope.room;
		
		response.reply("以下為此聊天室中的所有追蹤清單：");
		
		//拿到所有schedule
		schedules = getSchedule(room, robot);
		
    });
	
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

function analyseResult(json)
{
	
}

function getItemByLink(link)
{
	
}

function newItem(item_json)
{
	
}

function updateItem(item_json)
{
	
}