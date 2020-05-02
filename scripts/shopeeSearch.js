module.exports = function(robot) 
{
    robot.respond(/(搜尋)(.*)/, function(response) 
    {
		//var match = response.match;
		//response.reply(match);
		
		var keywords = response.match[2]; 
		var url = process.env.rootURL + ':4101/shopeeCrawler?keywords='+keywords;
		// do the search func.
		var encoded_url = encodeURI(url);
		
		response.reply("好的！開始搜尋「"+keywords+"」！");
		
		var request = require('request');
		request(encoded_url, function(error, res, body) 
		{
			if (!error && res.statusCode == 200) 
			{
				// parse the ' to ", because Rasa always return json with '
				response.reply(body);
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