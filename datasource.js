define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  './series',
  './query_builder',
  './directives',
  './query_ctrl',
  './aggr_add',
  './aggr_editor',
  './mget_editor',
],
function (angular, _, dateMath, DalmatinerSeries, DalmatinerQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('DataloopDatasource', function($q, backendSrv, templateSrv) {

    function DataloopDatasource(datasource) {
      this.urls = _.map(datasource.url.split(','), function(url) {
        return url.trim();
      });

      this.authKey = datasource.jsonData.authKey;
    }

    DataloopDatasource.prototype.query = function(options) {

      var queries = options.targets
            .filter(function hiddens(target) {return !target.hide;})
            .map(_.partial(buildQuery, options))
            .join(', ');

      //No query => return no data (inside a promise)
      if (!queries) {
        return $q(function(resolve) {resolve([]);});
      }

      var mainQuery = 'SELECT ' + templateSrv.replace(queries, options.scopedVars) + ' ' + getTimeFilter(options);

      return this.runQuery(mainQuery).then(function(res) {
        return {data: new DalmatinerSeries(res.s, res.d).getTimeSeries()};
      });
    };

    DataloopDatasource.prototype.runQuery = function(query) {
      return this._request('GET', '/metrics/series', {query: query});
    };

    DataloopDatasource.prototype.listAgents = function() {
      return this._request('GET', '/agents');
    };

    DataloopDatasource.prototype.listMetrics = function(agent) {
      return this._request('GET', '/metrics', {source: agent});
    };

    DataloopDatasource.prototype.testDatasource = function() {
      return this.listAgents().then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    DataloopDatasource.prototype._request = function(method, url, params) {

      var currentUrl = this.urls.shift();
      this.urls.push(currentUrl);

      var options = {
        method: method,
        url:    currentUrl + url,
        params: params,
        headers: {Authorization: 'Bearer ' + this.authKey}
      };

      return backendSrv.datasourceRequest(options).then(function ok(result) {
        return result.data;

      }, function error(err) {
        throw {message: 'Error: ' + (err.message || err.data || err.statusText), data: err.data, config: err.config };
      });
    };

    function isNumber(x) {
      return !isNaN(x);
    }

    function getTimeFilter(options) {
      var from = getDalmatinerTime(options.rangeRaw.from, false);
      var until = getDalmatinerTime(options.rangeRaw.to, true);
      var fromIsAbsolute = isNumber(from);

      if (until === 'now' && !fromIsAbsolute) {
        return 'LAST ' + from;
      }

      return 'BETWEEN ' + from + ' AND ' + until;
    }

    function getDalmatinerTime(date, roundUp) {
      if (_.isString(date)) {
        if (date === 'now') {
          return date;
        }

        var parts = /^now-(\d+)([d|h|m|s])$/.exec(date);
        if (parts) {
          var amount = parseInt(parts[1]);
          var unit = parts[2];
          return amount + unit;
        }
        date = dateMath.parse(date, roundUp);
      }
      return (date.valueOf() / 1000).toFixed(0);
    }

    function buildQuery(options, target) {
      var queryBuilder = new DalmatinerQueryBuilder(_.extend({
        bucket: target.agent,
        metric: target.metric.split('.')
            .map(encodeMetricPart)
            .join('.')
      }, target));
      return queryBuilder.build().replace(/\$interval/g, (target.interval || options.interval));
    }

    function encodeMetricPart(part) {
      return part === '*' ? part : "'" + part + "'";
    }

    return DataloopDatasource;

  });

});
