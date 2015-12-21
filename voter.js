"use strict";
var Chance = require('chance');
var logger = require('winston');
var fs = require('fs');
var cheerio = require('cheerio');
var async = require('async');
var _ = require('lodash');
var rp = require('request-promise');

var chance = new Chance();

const emailSuffix = '@mailnesia.com';
const votingApi = 'https://www.cewe-community.com/pl/naszagaleria/vote/';
const filename = 'voted_emails.txt';
const userAgent = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36';

var getRandomMail = function () {
  return chance.name().replace(' ', '.').toLocaleLowerCase() + emailSuffix;
};

var getRequestOptionsForUrl = function (url) {
  return {
    url: url,
    headers: {
      'User-Agent': userAgent
    }
  };
};

var getVotingRequestOptions = function (bookId, voterEmail, votingUrl) {
  var formData = {
    Email: voterEmail,
    BookID: bookId,
    UserID: 0
  };

  return {
    url: votingUrl,
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest"
    },
    form: formData,
    followAllRedirects: true
  };
};

var getMailnesiaReceivedEmailHtml = function (inboxHtml) {
  var $ = cheerio.load(inboxHtml);
  var emailRelativePath = $('body > table > tbody > tr > td:nth-child(2) > a').attr('href');

  return rp(getRequestOptionsForUrl('http://mailnesia.com' + emailRelativePath));
};

var getMailnesiaInboxHtml = function (username) {
  var mailnesiaUsernameInboxReqestOptions = getRequestOptionsForUrl('http://mailnesia.com/mailbox/' + username);

  return rp(mailnesiaUsernameInboxReqestOptions);
};

var getConfirmationUrl = function (username) {
  return getMailnesiaInboxHtml(username)
    .then(getMailnesiaReceivedEmailHtml)
    .then(function (receivedEmailHtml) {
      return receivedEmailHtml.match('\"(https://.*token=.*)\"')[1];
    });
};

var voteForBook = function (bookId) {
  var votingUrl = votingApi + bookId;
  var voterEmail = getRandomMail();
  var username = voterEmail.match("(.*)" + emailSuffix + "$")[1];
  logger.info('voting by: ' + voterEmail);

  return rp(getVotingRequestOptions(bookId, voterEmail, votingUrl))
    .then(function () {
      fs.appendFileSync(filename, voterEmail + '\n');
    })
    .then(function () {
      return username;
    });
};

var confirmUrl = function (confirmationUrl) {
  logger.info('confirming with URL: ' + confirmationUrl);

  return rp({
    url: confirmationUrl,
    followAllRedirects: true
  });
};

var getVoteAndConfirmAsyncFunctionForBook = function (bookId) {
  return function(callback){
    voteForBook(bookId)
      .delay(2000)
      .then(getConfirmationUrl)
      .then(confirmUrl)
      .catch(callback)
      .done(function () {
        logger.info('done');
        callback(null);
      });
  }
};


class Voter {
  constructor() {}

  vote(bookId, numberOfVotes, numberOfConcurrentRequests) {
    var voteAndConfirmAsyncFunction = getVoteAndConfirmAsyncFunctionForBook(bookId);
    async.parallelLimit(_.fill(Array(numberOfVotes), voteAndConfirmAsyncFunction), numberOfConcurrentRequests);
  }
}

module.exports = Voter;