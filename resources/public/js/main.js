'use strict';

require.config({
  paths: {
    'jQuery': '../bower_components/jquery/dist/jquery.min',
    'underscore': '../bower_components/underscore/underscore-min',
    'angular': '../bower_components/angular/angular.min',
    'angular-resource': '../bower_components/angular-resource/angular-resource.min',
    'angular-ui-router': '../bower_components/angular-ui-router/release/angular-ui-router.min',
    'jquery-slider': '../bower_components/jslider/dist/jquery.slider.min',
    'mmfoundation': '../bower_components/angular-foundation/mm-foundation-tpls.min'
  },
  baseUrl: 'js',
  shim: {
    'angular': { exports : 'angular' },
    'angular-resource': { deps:['angular'], exports: 'angular-resource' },
    'angular-ui-router': { deps:['angular'] },
    'underscore': { exports : '_' },
    'jQuery': { exports : 'jQuery' },
    'jquery-slider': { deps: ['jQuery'] },
    'mmfoundation': { deps: ['angular'] }
  },
  priority: ['angular']
});

define(function (require) {
  var angular = require("angular");
  var app = require("elicit");

  angular.bootstrap(document, ['elicit']);
});
