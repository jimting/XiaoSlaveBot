# Commands:
#   hubot 新增提醒 hh:mm 提醒事項 - 我會在 hh:mm 提醒您設定好的提醒事項。
#   hubot 新增提醒 hh:mm UTC+2 提醒事項 - 我會在 hh:mm UTC+2 提醒您設定好的提醒事項。
#   hubot 新增提醒 Monday@hh:mm UTC+2 提醒事項 - 我會在每個星期一的 hh:mm UTC+2 提醒您設定好的提醒事項。
#   hubot 列出提醒 - 看此聊天室的所有提醒.。
#   hubot 列出所有提醒- 列出所有提醒(包含其他聊天室)。
#   hubot 刪除提醒 提醒事項 - 刪除此提醒事項。
#   hubot 刪除所有提醒 - 刪除所有提醒事項。


cronJob = require('cron').CronJob
_ = require('underscore')

module.exports = (robot) ->
  # Compares current time to the time of the standup to see if it should be fired.
  standupShouldFire = (standup) ->
    standupTime = standup.time
    standupDayOfWeek = getDayOfWeek(standup.dayOfWeek)
    now = new Date()
    standupDate = new Date()
    utcOffset = -standup.utc or (now.getTimezoneOffset() / 60)

    standupHours = parseInt(standupTime.split(":")[0], 10)
    standupMinutes = parseInt(standupTime.split(":")[1], 10)

    standupDate.setUTCMinutes(standupMinutes)
    standupDate.setUTCHours(standupHours + utcOffset)

    result = (standupDate.getUTCHours() == now.getUTCHours()) and
      (standupDate.getUTCMinutes() == now.getUTCMinutes()) and
      (standupDayOfWeek == -1 or (standupDayOfWeek == standupDate.getDay() == now.getUTCDay()))

    if result then true else false

  # Returns the number of a day of the week from a supplied string. Will only attempt to match the first 3 characters
  # Sat/Sun currently aren't supported by the cron but are included to ensure indexes are correct
  getDayOfWeek = (day) ->
    if (!day)
      return -1
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day.toLowerCase().substring(0,3))

  # Returns all standups.
  getStandups = ->
    robot.brain.get('standups') or []

  # Returns just standups for a given room.
  getStandupsForRoom = (room) ->
    _.where getStandups(), room: room

  # Gets all standups, fires ones that should be.
  checkStandups = ->
    standups = getStandups()
    _.chain(standups).filter(standupShouldFire).pluck('room').each doStandup
    return

  # Fires the standup message.
  doStandup = (room) ->
    standups = getStandupsForRoom(room)
    if standups.length > 0
      # Do some magic here to loop through the standups and find the one for right now
      theStandup = standups.filter(standupShouldFire)
      message = "#{_.sample(STANDUP_MESSAGES)} #{theStandup[0].note}"
    else
      message = "#{_.sample(STANDUP_MESSAGES)} #{standups[0].note}"
    robot.messageRoom room, message
    return

  # Finds the room for most adaptors
  findRoom = (msg) ->
    room = msg.envelope.room
    if _.isUndefined(room)
      room = msg.envelope.user.reply_to
    room

  # Confirm a time is in the valid 00:00 format
  timeIsValid = (time) ->
    validateTimePattern = /([01]?[0-9]|2[0-4]):[0-5]?[0-9]/
    return validateTimePattern.test time

  # Stores a standup in the brain.
  saveStandup = (room, dayOfWeek, time, utcOffset, note, msg) ->
    if !timeIsValid time
      msg.send "你的時間輸入錯誤了吧？檢查一下"
      return

    standups = getStandups()
    newStandup =
      room: room
      dayOfWeek: dayOfWeek
      time: time
      utc: utcOffset
      note: note
    standups.push newStandup
    updateBrain standups
    displayDate = dayOfWeek or '每天'
    msg.send '現在開始我會在'+displayDate+'的'+time+'提醒您'+ note
    return

  # Updates the brain's standup knowledge.
  updateBrain = (standups) ->
    robot.brain.set 'standups', standups
    return

  # Remove all standups for a room
  clearAllStandupsForRoom = (room, msg) ->
    standups = getStandups()
    standupsToKeep = _.reject(standups, room: room)
    updateBrain standupsToKeep
    standupsCleared = standups.length - (standupsToKeep.length)
    msg.send '已經把在 '+room+' 內共 '+standupsCleared+' 筆的提醒所刪除，狀態:'+standupsCleared
    return

  # Remove specific standups for a room
  clearSpecificStandupForRoom = (room, note, msg) ->

    standups = getStandups()
    standupsToKeep = _.reject(standups,
      room: room
      note: ' '+note)
    updateBrain standupsToKeep
    standupsCleared = standups.length - (standupsToKeep.length)
    if standupsCleared == 0
      msg.send '找不到 '+note+' 這個提醒！'
    else
      msg.send '刪除成功！提醒: ' + note + ' 已被刪除.'
    return

  # Responsd to the help command
  sendHelp = (msg) ->
    message = []
    message.push '貼心的PP可以協助提醒你任何事情！'
    message.push '以下是使用手冊:'
    message.push ''
    message.push robot.name + ' 新增提醒 hh:mm 提醒事項 - 我會在 hh:mm 提醒您設定好的提醒事項。'
    message.push robot.name + ' 新增提醒 hh:mm UTC+2 提醒事項 - 我會在 hh:mm UTC+2 提醒您設定好的提醒事項。'
    message.push robot.name + ' 新增提醒 Monday@hh:mm UTC+2 提醒事項 - 我會在每個星期一的 hh:mm UTC+2 提醒您設定好的提醒事項。'
    message.push robot.name + ' 列出提醒 - 看此聊天室的所有提醒.。'
    message.push robot.name + ' 列出所有提醒- 列出所有提醒(包含其他聊天室)。'
    message.push robot.name + ' 刪除提醒 提醒事項 - 刪除此提醒事項。'
    message.push robot.name + ' 刪除所有提醒 - 刪除所有提醒事項。'
    msg.send message.join('\n')
    return

  # List the standups within a specific room
  listStandupsForRoom = (room, msg) ->
    standups = getStandupsForRoom(findRoom(msg))
    if standups.length == 0
      msg.send '這個房間裡還沒有任何的提醒哦！'
    else
      standupsText = [ '這裡是這間房間所有的提醒:' ].concat(_.map(standups, (standup) ->
        text =  '時間: ' + standup.time
        if standup.utc
          text += ' UTC' + standup.utc
        if standup.note
          text +=', 提醒內容: '+ standup.note
        text
      ))
      msg.send standupsText.join('\n')
    return

  listStandupsForAllRooms = (msg) ->
    standups = getStandups()
    if standups.length == 0
      msg.send '所有的房間都沒有任何提醒QQ'
    else
      standupsText = [ '這裡是所有的提醒哦(包括其他房間):' ].concat(_.map(standups, (standup) ->
        text =  '房名: ' + standup.room + ', 時間: ' + standup.time
        if standup.utc
          text += ' UTC' + standup.utc
        if standup.note
          text +=', 提醒內容: '+ standup.note
        text
      ))
      msg.send standupsText.join('\n')
    return

  'use strict'
  # Constants.
  STANDUP_MESSAGES = [
    '提醒提醒！'
  ]
  PREPEND_MESSAGE = process.env.HUBOT_STANDUP_PREPEND or ''
  if PREPEND_MESSAGE.length > 0 and PREPEND_MESSAGE.slice(-1) != ' '
    PREPEND_MESSAGE += ' '

  # Check for standups that need to be fired, once a minute
  # Monday to Friday.
  new cronJob('1 * * * * 1-5', checkStandups, null, true)

  # Global regex should match all possible options
  robot.respond /(.*)提醒? ?(?:([A-z]*)\s?\@\s?)?((?:[01]?[0-9]|2[0-4]):[0-5]?[0-9])?(?: UTC([- +]\d\d?))?(.*)/i, (msg) ->
    action = msg.match[1].trim().toLowerCase()
    dayOfWeek = msg.match[2]
    time = msg.match[3]
    utcOffset = msg.match[4]
    note = msg.match[5]
    room = findRoom msg

    switch action
      when '新增' then saveStandup room, dayOfWeek, time, utcOffset, note, msg
      when '列出' then listStandupsForRoom room, msg
      when '列出所有' then listStandupsForAllRooms msg
      when '刪除' then clearSpecificStandupForRoom room, note, msg
      when '刪除所有' then clearAllStandupsForRoom room, msg
      when '如何' then sendHelp msg
    return

return
