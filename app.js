var Voter = require('./voter');

var voter = new Voter();

const BOOK_ID = 24518;
const NUMBER_OF_VOTES = 10;
const NUMBER_OF_CONCURRENT_REQUESTS = 1;

voter.vote(BOOK_ID, NUMBER_OF_VOTES, NUMBER_OF_CONCURRENT_REQUESTS);