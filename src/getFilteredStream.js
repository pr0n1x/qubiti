const through2 = require('through2')
	,filter = require('gulp-filter');

function getFilteredStream(flt) {
	if (typeof flt === 'string' && flt.length > 0) {
		flt = flt.replace(/\*\*\*/g, '**/{,.*/**}');
		console.log('flt', flt);
		return filter(flt);
	}
	return through2.obj();
}

module.exports = getFilteredStream;
