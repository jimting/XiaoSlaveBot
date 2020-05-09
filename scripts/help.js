module.exports = function(robot) 
{
    robot.respond(/怎麼用|how to use|help|如何使用|教我|怎麼用/, function(response) 
    {
		var help_result = "以下是我的使用方式：\n";
		help_result += "@我+「追蹤 ABC」：每個整點我會幫你查詢蝦皮的商品並分析是否有新增與價格變更。\n";
		help_result += "@我+「追蹤 ABC」：每個整點我會幫你查詢蝦皮的商品並分析是否有新增與價格變更。\n";
		help_result += "@我+「追蹤清單」：列出此頻道的所有追蹤關鍵字。\n";
		help_result += "@我+「取消追蹤 ABC」：取消追蹤商品。\n";
		help_result += "@我+「新增提醒 hh:mm 提醒事項」：我會在 hh:mm 提醒您設定好的提醒事項。"
		help_result += "@我+「新增提醒 hh:mm UTC+2 提醒事項」：我會在 hh:mm UTC+2 提醒您設定好的提醒事項。\n"
		help_result += "@我+「新增提醒 Monday@hh:mm UTC+2 提醒事項」：我會在每個星期一的 hh:mm UTC+2 提醒您設定好的提醒事項。\n"
		help_result += "@我+「列出提醒」：看此聊天室的所有提醒.。\n"
		help_result += "@我+「列出所有提醒」：列出所有提醒(包含其他聊天室)。\n"
		help_result += "@我+「刪除提醒 提醒事項」：刪除此提醒事項。\n"
		help_result += "@我+「刪除所有提醒」：刪除所有提醒事項。\n";
        response.reply(help_result);
    });
}