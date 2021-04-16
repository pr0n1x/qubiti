'use strict';

/**
 * @param {Object} object
 * @param {RegExp} search
 * @param {(boolean|string|number)} replace
 * @param {number} [callCount]
 */
function dereferencePlaceHolder(object, search, replace, callCount) {
  if (typeof(callCount) == 'undefined') callCount = 1;
  // noinspection JSCheckFunctionSignatures
  if (parseInt(callCount) <= 1) callCount = 1;
  if (typeof(object) != 'object') return;
  if(Array.isArray(object)) {
    for(let key=0; key < object.length; key++) {
      dereferenceItem(object, key, search, replace, callCount);
    }
  }
  else {
    for(let key in object) {
      if(object.hasOwnProperty(key)) {
        dereferenceItem(object, key, search, replace, callCount);
      }
    }
  }
}
function dereferenceItem(object, key, search, replace, callCount) {
  switch(typeof(object[key])) {
    case 'object':
      //onsole.log(offset+key+':object:'+callcount);
      dereferencePlaceHolder(object[key], search, replace, (callCount+1));
      break;
    case 'string':
      //onsole.log(offset+key+':string:'+callcount);
      object[key] = object[key].replace(search, replace);
      break;
    default:
      break;
  }
}

exports.dereferencePlaceHolder = dereferencePlaceHolder;
exports.dereferenceItem = dereferenceItem;
