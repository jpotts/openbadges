var _ = require('underscore');
var Group = require('../models/group.js');
var Portfolio = require('../models/portfolio.js');
var Badge = require('../models/badge.js');
var logger = require('../lib/logging').logger;

function makeBadgeObj (attr) { return new Badge(attr) }

exports.param = {
  groupId: function(request, response, next, id) {
    Group.findById(id, function(err, group) {
      if (err) {
        logger.error("Error pulling group: " + err);
        return response.send({
          status: 'error',
          'error': 'Error pulling group'
        }, 500);
      }
      
      if (!group) 
       return response.send({
         status: 'missing',
         error: 'Could not find group'
        }, 404);
      
      request.group = group;
      return next();
    });
  }
}

exports.create = function (request, response) {
  if (!request.user)
    return response.json({error: 'no user'}, 403);
  
  if (!request.body)
    return response.json({error: 'no badge body'}, 400);
  
  if (!request.body.badges)
    return response.json({error: 'no badges'}, 400);
  
  var user = request.user;
  var body = request.body;
  var badges = body.badges;
  var group = new Group({
    user_id: user.get('id'),
    name: body.name,
    badges: badges.map(makeBadgeObj)
  }); 

  group.save(function (err, group) {
    if (err) {
      logger.debug('there was some sort of error creating a group:');
      logger.debug(err);
      return response.send('there was an error', 500)
    }
    response.contentType('json');
    response.send({id: group.get('id'), url: group.get('url')});
  })
};

exports.update = function (request, response) {
  if (!request.user)
    return response.send({
      status: 'forbidden',
      error: 'user required'
    }, 403);
  
  if (!request.group)
    return response.send({
      status: 'missing-required',
      error: 'missing group to update'
    }, 400);
  
  if (request.user.get('id') !== request.group.get('user_id'))
    return response.send({
      status: 'forbidden',
      error: 'you cannot modify a group you do not own'
    }, 403);
  
  if (!request.body)
    return response.send({
      status: 'missing-required',
      error: 'missing fields to update'
    }, 400)
  
  var group = request.group;
  var body = request.body;
  
  if (body.name) {
    var saferName = body.name.replace('<', '&lt;').replace('>', '&gt;');
    group.set('name', saferName);
  }
  
  if (body['public']) {
    group.set('public', !!body['public']);
  }
  
  if (body.badges) {
    group.set('badges', body.badges.map(makeBadgeObj));
  }
  
  group.save(function (err) {
    if (err) {
      logger.debug('there was an error updating a group:');
      logger.debug(err);
      return response.send({
        status: 'error',
        error: 'there was an unknown error. it has been logged.'
      }, 500);
    }
    
    response.contentType('json');
    response.send({status: 'okay'});
  })
};

exports.destroy = function (request, response) {
  var user = request.user;
  var group = request.group;
  
  if (!user)
    return response.send('no logged in user', 403);
  
  if (!group)
    return response.send('group not found', 404);
  
  if (group.get('user_id') !== user.get('id'))
    return response.send('group not yours', 403);
  
  // find any profile associated with this group and delete it
  Portfolio.findOne({group_id: group.get('id')}, function (err, folio) {
    if (err) {
      logger.debug('error finding portfolios:');
      logger.debug(err);
      return response.send('nope', 500);
    }
    
    if (folio) folio.destroy();
    
    group.destroy(function (err) {
      if (err) {
        logger.debug('error deleting group');
        logger.debug(err);
        return response.send('nope', 500);
      }
      response.contentType('json');
      response.send(JSON.stringify({success: true}));
    })
  })
};