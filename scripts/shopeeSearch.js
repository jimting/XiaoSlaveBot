module.exports = function(robot) 
{
    robot.respond(/(搜尋)(.*)/, function(response) 
    {
		//var match = response.match;
		//response.reply(match);
		
		var keywords = response.match[2]; 
		
		// do the search func.
		var request = require('request');
		var options = {
		  uri: process.env.rootURL + ':4101/shopeeCrawler?keywords='+keywords,
		  method: 'POST'
		};
		
		response.reply("好的！開始搜尋「"+keywords+"」！");
		
		request(options, function (error, res, body) 
		{
			if (!error && res.statusCode == 200) 
			{
				// parse the ' to ", because Rasa always return json with '
				response.reply(body[0].text);
				//var json_data = JSON.parse((body[0].text));
				
			}
			if(error)
			{
				response.reply("搜尋中出了點錯誤！\n"+error);
				// end the flow
			}
		});
    });
}