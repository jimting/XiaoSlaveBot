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

module.exports = function(robot) 
{
	/*########## 監聽舊Item更新事件 ##########*/
    var sub = rabbitmq.socket('SUBSCRIBE');
    sub.connect('itemUpdate');
    sub.setEncoding('utf8');
    sub.on('data', function(note) {
		//把有設定這個keyword的頻道都找出來，一一推通知給他們！
        var item_json = JSON.parse(note);
		itemUpdateNotify(item_json, robot);
    });
	
	/*########## 監聽新Item插入事件 ##########*/
	var sub = rabbitmq.socket('SUBSCRIBE');
    sub.connect('itemInsert');
    sub.setEncoding('utf8');
    sub.on('data', function(note) {
		//把有設定這個keyword的頻道都找出來，一一推通知給他們！
        var item_json = JSON.parse(note);
		itemInsertNotify(item_json, robot);
    });
	
}

//利用商品的Link找到此商品的所有Keyword，並將更新資訊推給schedule內有訂閱這些keyword的頻道
function itemUpdateNotify(item_json, robot)
{
	var bot_speaking = "";
	bot_speaking += "你所追蹤的「" + item_json.keywords + "」有件相關商品更新了！\n";
	bot_speaking += "商品名稱：" + item_json.name + "\n";
	bot_speaking += "商品圖片：" + item_json.img + "\n";
	bot_speaking += "商品價錢：" + item_json.price + "\n";
	bot_speaking += "連結：" + item_json.link + "\n";
			
	findChannelAndSendNotify(robot, item_json.keywords, bot_speaking);
}

//利用商品的Link找到此商品的所有Keyword，並將新物品資訊推給schedule內有訂閱這些keyword的頻道
function itemInsertNotify(item_json, robot)
{
	var bot_speaking = "";
	bot_speaking += "你所追蹤的「" + item_json.keywords + "」有一件新商品出現了！\n";
	bot_speaking += "商品名稱：" + item_json.name + "\n";
	bot_speaking += "商品圖片：" + item_json.img + "\n";
	bot_speaking += "商品價錢：" + item_json.price + "\n";
	bot_speaking += "連結：" + item_json.link + "\n";
			
	findChannelAndSendNotify(robot, item_json.keywords, bot_speaking);
}

//找出訂閱這個keyword的channel 給他們通知！
function findChannelAndSendNotify(robot, keyword, notify_content)
{
	var connection = mysql.createConnection({     
		host     : db_server,       
		user     : db_user,              
		password : db_passwd,       
		port: db_port,                   
		database: db_name 
	}); 
	 
	connection.connect();
	 
	var sql = 'SELECT DISTINCT room FROM schedule where keyword="'+keyword+'"';
	//查尋指令
	connection.query(sql,function (err, result) {
		if(err)
		{
			console.log('[SELECT ERROR] - ',err.message);
			return;
		}
		 
		console.log('---找出訂閱「'+keyword+'」的channel 給他們通知！---');
		var json_data = JSON.parse(JSON.stringify(result));
		console.log(json_data);
		for(var i = 0;i < json_data.length; i++)
		{
			robot.messageRoom(json_data[i].room, notify_content);
		}
		console.log('------------------------------------------------------------\n\n');  
	});
	 
	connection.end();
}




