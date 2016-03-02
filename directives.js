define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorDataloop', function() {
    return {controller: 'DataloopQueryCtrl', templateUrl: 'app/plugins/datasource/dataloop/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsDataloop', function() {
    return {templateUrl: 'app/plugins/datasource/dataloop/partials/query.options.html'};
  });
});
