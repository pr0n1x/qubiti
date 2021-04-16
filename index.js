'use strict';
const { task, series } = require('gulp');

task('some', function(done) {
  console.log('some');
  done();
});

function html(done) {

  done();
}

function help(done) {
  console.log('Under heavy development');
  done();
}

exports.html = html;
exports.help = help;
exports.default = help;
