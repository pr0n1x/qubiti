'use strict';
import jquery from 'jquery'
import 'bootstrap/js/src/collapse';
import assign from 'lodash/assign';
import debounce from 'lodash/debounce';

global.$ = global.jquery = jquery;
global._ = {
	assign, debounce
};

