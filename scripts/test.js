module.exports = function(robot) 
{
    robot.hear(/你好/, function(response) 
    {
        response.reply("安安");
    });
}