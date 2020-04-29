'use strict';
import jquery from 'jquery'
import 'bootstrap/js/src/collapse';
import test_vendor_1 from './lib/test_vendor_1';
import assign from 'lodash/assign';
import debounce from 'lodash/debounce';

global.$ = global.jquery = jquery;
global._ = {
	assign, debounce
};

test_vendor_1();
