var Chance = require('chance');
var request = require('request');
var logger = require('winston');
var fs = require('fs');
var cheerio = require('cheerio');
var async = require('async');
var _ = require('lodash');

var chance = new Chance();

const bookId = 24518;
const emailSuffix = '@mailnesia.com';
const votingUrl = 'https://www.cewe-community.com/pl/naszagaleria/vote/' + bookId;
const filename = 'voted_emails.txt';
const userAgent = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36';

var getRandomMail = function () {
  return chance.name().replace(' ', '.').toLocaleLowerCase() + emailSuffix;
};

var getMailnesiaInboxHtml = function (username, cb) {
  var mailnesiaUsernameInboxReqestOptions = {
    url: 'http://mailnesia.com/mailbox/' + username,
    headers: {
      'User-Agent': userAgent
    }
  };

  request(mailnesiaUsernameInboxReqestOptions, function (err, response, body) {
    if (!err) {
      cb(null, body);
    } else {
      logger.error('Problem with retrieving mailnesia inbox html for: ' + username);
      cb(err);
    }
  });
};

var getMailnesiaReceivedEmailHtml = function (emailRelativePath, cb) {
  var mailnesiaReceivedEmailRequestOptions = {
    url: 'http://mailnesia.com' + emailRelativePath,
    headers: {
      'User-Agent': userAgent
    }
  };

  request(mailnesiaReceivedEmailRequestOptions, function (err, response, body) {
    if (!err) {
      cb(null, body);
    } else {
      cb(err);
    }
  });

};

var getConfirmUrl = function (username, cb) {
  getMailnesiaInboxHtml(username, function (err, html) {
    if (!err) {
      $ = cheerio.load(html);  //todo captcha validation
      var emailHref = $('body > table > tbody > tr > td:nth-child(2) > a').attr('href');

      getMailnesiaReceivedEmailHtml(emailHref, function (err, html) {
        if (!err) {
          var confirmUrl = html.match('\"(https://.*token=.*)\"')[1];
          cb(null, confirmUrl);
        } else {
          logger.error('There was a problem with opening mailnesia received email: ' + username);
          cb(err);
        }
      });
    }
  });
};

var confirmVoting = function (username, cb) {
  getConfirmUrl(username, function (err, confirmUrl) {
    if (err) {
      logger.error('Problem with receiving confirm url.');
      cb(err);
    } else {
      request.get({
        url: confirmUrl,
        followAllRedirects: true
      }, function (err, request, body) {
        if (err) {
          logger.error('Problem with confirming vote.');
          cb(err);
        } else {
          cb(null, username);
        }
      });
    }
  });
};

var randomVote = function (cb) {
  console.log('voting...');
  var voterEmail = getRandomMail();
  var username = voterEmail.match("(.*)" + emailSuffix + "$")[1];

  var formData = {
    Email: voterEmail,
    BookID: bookId,
    UserID: 0
  };
  var options = {
    url: votingUrl,
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest"
    },
    form: formData,
    followAllRedirects: true
  };

  request(options, function (err, response, body) {
    if (err) {
      logger.error('There was a problem with submitting email: ' + voterEmail + ' for voting.')
      cb(err);
    } else {
      setTimeout(function () {
          confirmVoting(username, cb)
        }, 2000);
    }
  });
};


const NUMBER_OF_VOTES = 10;
var asyncFunction = function(cb){
  randomVote(function (err, votingUsername) {
    if (err) {
      logger.error(err);
      cb(err);
    } else {
      fs.appendFileSync(filename, votingUsername + '\n');
      logger.info('Succesfully voted by username: ' + votingUsername);
      cb(null, votingUsername);
    }
  });
};
async.parallelLimit(_.fill(Array(NUMBER_OF_VOTES), asyncFunction), 3);