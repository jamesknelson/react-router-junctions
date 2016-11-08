import React from 'react'
import { createConverter, locationsEqual } from 'junctions'


function createSearch(query) {
  var keys = Object.keys(query)

  if (keys.length === 0) {
    return ''
  }

  var parts = []
  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i]
    var value = query[key]
    parts.push(value === '' ? key : key+'='+encodeURIComponent(value))
  }

  return '?' + parts.join('&')
}


export function createReactRoute(component, junctions, path) {
  function getBaseLocation(routerState) {
    var location = routerState.location

    var i, key, len
    var baseQuery = {}
    var locationKeys = Object.keys(location.query || {})

    for (i = 0; i < locationKeys.length; i++) {
      key = locationKeys[i]
      baseQuery[key] = location.query[key]
    }

    var queryKeys = junctions.main ? junctions.main.$$junctionMeta.queryKeys : []
    for (i = 0, len = queryKeys.length; i < len; i++) {
      key = queryKeys[i]
      delete baseQuery[key]
    }

    var nonJunctionsState = {}
    var stateKeys = Object.keys(location.state || {})
    for (i = 0, len = stateKeys.length; i < len; i++) {
      key = stateKeys[i]
      if (key !== '$$junctions') {
        nonJunctionsState[key] = location.state[key]
      }
    }
    
    return {
      pathname: location.pathname.replace('/'+routerState.params.splat, '') || '/',
      search: createSearch(baseQuery),
      state: nonJunctionsState,
      hash: location.hash,
      key: location.key,
    }
  }

  // We can't figure out the base location until our Mount component has been
  // mounted, but once we *do* know it it won't change. So we store it here
  // to prevent needing to create multiple converters.
  var _converter
  function getConverter(routerState) {
    if (!_converter) {
      _converter = createConverter(junctions, getBaseLocation(routerState))
    }
    return _converter
  }

  var JunctionMount = React.createClass({
    contextTypes: {
      router: React.PropTypes.object
    },

    childContextTypes: {
      history: React.PropTypes.object
    },

    getChildContext: function() {
      return {
        history: this.context.router
      }
    },

    componentWillMount: function() {
      this.converter = getConverter(this.props)
    },

    render: function render() {
      return (
        React.createElement(component, {
          routes: this.converter.route(this.props.location),
          locate: this.converter.locate,
        })
      )
    }
  })

  function handleChange(_, nextState, replace) {
    var converter = getConverter(nextState)
    var currentRouteSet = converter.route(nextState.location)

    if (!currentRouteSet) {
      console.error('react-junctions: Unknown location received')
      return
    }

    var canonicalLocation = converter.locate(currentRouteSet)
    if (!locationsEqual(canonicalLocation, nextState.location)) {
      replace(canonicalLocation)
    }
  }

  return {
    component: JunctionMount,
    onEnter: handleChange.bind(null, {}),
    onChange: handleChange,
    path: (path === '/' || path === '') ? '**' : `${path}(/**)`
  }
}


export const Mount = React.createClass({
  displayName: 'Mount',

  propTypes: {
    path: React.PropTypes.string.isRequired,
    component: React.PropTypes.func.isRequired,
  },

  statics: {
    createRouteFromReactElement: function createRouteFromReactElement(element) {
      var component = element.props.component
      return createReactRoute(component, component.junctions, element.props.path)
    },
  },

  render: function render() {
    throw new Error('<Mount> elements are for router configuration and should not be rendered')
  },
})
