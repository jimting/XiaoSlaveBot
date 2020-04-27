module.exports = function(robot) 
{
    robot.respond(/怎麼用|how to use|help|如何使用|教我|怎麼用/, function(response) 
    {
		var help_result = "以下是我的使用方式：\n";
		help_result += "ㄎㄎ 目前還沒有任何功能哦XD";
        response.reply(help_result);
    });
}