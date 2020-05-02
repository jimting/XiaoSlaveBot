module.exports = function(robot) 
{
    robot.respond(/(\S*)\s(\S*)\s?(.*)?/, function(response) 
    {
		var result = data.text.match(command);
		response.reply(result);
    });
}


/*
function stage_rasa(bot, robot, data, team_name)
{
	var request = require('request');
	var options = {
	  uri: process.env.RasaUrl + '/webhooks/rest/webhook',
	  method: 'POST',
	  json: 
	  {
		"message": data.text
	  }
	};
	
	request(options, function (error, res, body) 
	{
		if (!error && res.statusCode == 200) 
		{
			// parse the ' to ", because Rasa always return json with '
			var json_data = JSON.parse((body[0].text).replace(/'/g, '"'));
			console.log(json_data);
			var intent = json_data.intent;
			var service = json_data.service;

			// check what result it is ! 
			// json : {'intent': 'action_name', 'service': 'service_name'}
			// check if the result include the service name.
			
			var stage = robot.brain.get('stage'+data.channel);
			console.log("此對話階段 : " + stage);
			if(stage == 2 && stage != null)
			{
				console.log("有先前對話進行中");
				intent_before = robot.brain.get('intent'+data.channel);
				stage_check_intent(bot, robot, data, team_name, service, intent_before);
			}
			else if(intent != "none")
			{
				stage_check_intent(bot, robot, data, team_name, service, intent);
			}
			else
			{
				var result = "Sorry, I don't know what you wanna do accurately. Please retry again!";
				bot.postMessage(data.channel, result);
				// end the flow
			}
		}
		if(error)
		{
			robot.send(admin_data,"Rasa Server is inactive! Please check it!");
			bot.postMessage(data.channel, "Sorry, the server got something wrong. I'll be back in minutes! QAQ");
			// end the flow
		}
	});
}*/