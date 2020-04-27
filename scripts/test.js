module.exports = function(robot) 
{
    robot.hear(/你好/, function(response) 
    {
        response.send("安安");
    });
}