"use strict";

var Chance = require('chance');
var request = require('request');
var logger = require('winston');
var fs = require('fs');
var cheerio = require('cheerio');
var async = require('async');
var _ = require('lodash');
var Q = require('Q');

var chance = new Chance();

const emailSuffix = '@mailnesia.com';
const votingApi = 'https://www.cewe-community.com/pl/naszagaleria/vote/';
const filename = 'voted_emails.txt';
const userAgent = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36';

var getRandomMail = function () {
  return chance.name().replace(' ', '.').toLocaleLowerCase() + emailSuffix;
};

class Voter {
  constructor(){}
  vote(bookId, numberOfVotes, concurrentRequests){
    const votingUrl = votingApi + bookId;

    var getMailnesiaReceivedEmailHtml = function (inboxHtml) {
      var deferred = Q.defer();

      var $ = cheerio.load(inboxHtml);
      var emailRelativePath = $('body > table > tbody > tr > td:nth-child(2) > a').attr('href');

      var mailnesiaReceivedEmailRequestOptions = {
        url: 'http://mailnesia.com' + emailRelativePath,
        headers: {
          'User-Agent': userAgent
        }
      };

      request(mailnesiaReceivedEmailRequestOptions, function (err, response, body) {
        if (!err) {
          deferred.resolve(body);
        } else {
          deferred.reject(err);
        }
      });

      return deferred.promise;
    };

    var getMailnesiaInboxHtml = function (username) {
      var deferred = Q.defer();

      var mailnesiaUsernameInboxReqestOptions = {
        url: 'http://mailnesia.com/mailbox/' + username,
        headers: {
          'User-Agent': userAgent
        }
      };

      request(mailnesiaUsernameInboxReqestOptions, function (err, response, body) {
        if (!err) {
          deferred.resolve(body);
        } else {
          logger.error('Problem with retrieving mailnesia inbox html for: ' + username);
          deferred.reject(err);
        }
      });

      return deferred.promise;
    };

    var getConfirmationUrl = function (username) {
      var deferred = Q.defer();

      getMailnesiaInboxHtml(username)
        .then(getMailnesiaReceivedEmailHtml)
        .then(function (receivedEmailHtml) {
          var confirmUrl = receivedEmailHtml.match('\"(https://.*token=.*)\"')[1];
          deferred.resolve(confirmUrl);
        }, function (error) {
          logger.error("Couldn't receive confirmation url. Possible captcha.");
          deferred.reject(error);
        });


      return deferred.promise;
    };

    var randomVote = function () {
      var deferred = Q.defer();
      var voterEmail = getRandomMail();
      var username = voterEmail.match("(.*)" + emailSuffix + "$")[1];
      logger.info('voting by: ' + voterEmail);

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
          deferred.reject(err);
        } else {
          fs.appendFileSync(filename, voterEmail + '\n');
          deferred.resolve(username);
        }
      });

      return deferred.promise;
    };

    var confirmUrl = function (confirmationUrl) {
      logger.info('confirming with URL: ' + confirmationUrl);
      var deferred = Q.defer();

      var confirmationUrlRequestOptions = {
        url: confirmationUrl,
        followAllRedirects: true
      };

      request.get(confirmationUrlRequestOptions, function (err, request, body) {
        if (err) {
          logger.error('Problem with confirming vote.');
          deferred.reject(err);
        } else {
          deferred.resolve();
        }
      });

      return deferred.promise;
    };

    var voteAndConfirm = function (callback) {
      return randomVote()
        .delay(2000)
        .then(getConfirmationUrl)
        .then(confirmUrl)
        .catch(callback)
        .done(function () {
          logger.info('done');
          callback(null);
        });
    };


    async.parallelLimit(_.fill(Array(numberOfVotes), voteAndConfirm), concurrentRequests);
  }
}

module.exports = Voter;