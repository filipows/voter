var Chance = require('chance');
var request = require('request');
var logger = require('winston');
var fs = require('fs');
var cheerio = require('cheerio');

var chance = new Chance();

const bookId = 24518;
const emailSuffix = '@mailnesia.com';
const votingUrl = 'https://www.cewe-community.com/pl/naszagaleria/vote/' + bookId;
const filename = 'voted_emails.txt';

var getRandomMail = function () {
  return chance.name().replace(' ', '.').toLocaleLowerCase() + emailSuffix;
};

var vote = function (done) {
  var voterEmail = getRandomMail();
  var emailPrefix = voterEmail.match("(.*)" + emailSuffix + "$")[1];

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
    if (err) throw err;
    logger.info('Voted for: ' + voterEmail + ' | StatusCode:' + response.statusCode);
    fs.appendFileSync(filename, voterEmail + '\n');

    var mailnesiaReqOptions = {
      url: 'http://mailnesia.com/mailbox/' + emailPrefix,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36',
      }
    };
    setTimeout(function(){
      request(mailnesiaReqOptions, function (err, response, body) {
        if (!err) {
          $ = cheerio.load(body);
          var href = $('body > table > tbody > tr > td:nth-child(2) > a').attr('href');
          var mailnesiaReqOptions2 = {
            url: 'http://mailnesia.com' + href,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36',
            }
          };
          request(mailnesiaReqOptions2, function (err, response, body) {
            if (!err) {
              var votingUrl = body.match('\"(https://.*token=.*)\"')[1];
              console.log(votingUrl);

              request.get({
                url: votingUrl,
                followAllRedirects: true
              }, function (err, request, body) {
                done();
              });
            } else {
              logger.warn('There was a problem with receiving data from mailnesia.com');
              done();
            }
          });
        }
      });
    },2000);
  });
};

var NUMBER_OF_VOTES = 20;

var cb = function () {
  if (--NUMBER_OF_VOTES > 0) {
    vote(cb);
  }
};
//vote(cb);

for (var i = 0; i < NUMBER_OF_VOTES; i++){
  (function(index){
    setTimeout(function(){
      vote(function(){
        console.log('voted: ' + index);
      });
    },1000);
  })(i);
}