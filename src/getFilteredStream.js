const through2 = require('through2')
	,filter = require('gulp-filter');

function getFilteredStream(flt) {
	if (typeof flt === 'string' && flt.length > 0) {
		flt = flt.replace(/\*\*\*/g, '**/{,.*/**}');
		return filter(flt);
	}
	return through2.obj();
}

module.exports = getFilteredStream;
