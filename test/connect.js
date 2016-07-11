import assert from 'power-assert';
import { setup, teardown } from './stub/dom';

import { connect } from '../src/connect';

import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

describe('connect', () => {
  let state, mutations, actions, getters, store, options, Component;

  beforeEach(() => {
    setup();

    state = {
      foo: 'bar',
      bar: 5,
      baz: true
    };

    mutations = {
      UPDATE_FOO(state, value) { state.foo = value; },
      UPDATE_BAR(state, value) { state.bar = value; }
    };

    actions = {
      foo: ({ commit }, value) => commit('UPDATE_FOO', value),
      bar: ({ commit }, value) => commit('UPDATE_BAR', value)
    };

    getters = {
      foo: state => state.foo,
      bar: state => state.bar,
      baz: state => state.baz
    };

    store = new Vuex.Store({ state, mutations, actions, getters });

    options = {
      props: ['a', 'b', 'c'],
      render(h) {
        return h('div', null, [
          h('div', { id: 'component-prop-1' }, this.a),
          h('div', { id: 'component-prop-2' }, this.b)
        ]);
      }
    };

    Component = Vue.extend(options);
  });

  afterEach(teardown);

  it('returns wrapped Vue component', () => {
    const actual = connect()('example', Component);
    assert(typeof actual === 'function');
  });

  it('sets name to given component', () => {
    const Container = connect()('test', Component);
    const container = mountContainer(store, Container);
    const actual = container.$children[0];

    assert(actual.$options._componentTag === 'test');
  });

  it('binds getter functions', () => {
    const Container = connect({
      a: 'foo',
      b: 'bar'
    })('example', Component);

    const actual = mountContainer(store, Container);

    assert(actual.a === 'bar');
    assert(actual.b === 5);
  });

  it('binds actions', () => {
    const Container = connect(null, {
      c: 'foo'
    })('example', Component);

    const actual = mountContainer(store, Container);

    assert(store.state.foo === 'bar');
    actual.c('baz');
    assert(store.state.foo === 'baz');
  });

  it('binds getter values to component props', (done) => {
    const Container = connect({
      a: 'foo',
      b: 'bar'
    })('example', Component);

    const container = mountContainer(store, Container);
    const actual = container.$children[0];

    assert(actual.a === 'bar');
    assert(actual.b === 5);

    store.state.foo = 'baz';

    actual.$nextTick(() => {
      // ensure the props can detect changes
      assert(actual.a === 'baz');
      done();
    });
  });

  it('binds actions to component props', () => {
    const Container = connect(null, {
      c: 'bar'
    })('example', Component);

    const container = mountContainer(store, Container);
    const actual = container.$children[0];

    assert(store.state.bar === 5);
    actual.c(10);
    assert(store.state.bar === 10);
  });

  it('injects lifecycle hooks', (done) => {
    let C;
    let count = 0;

    function _assert(_store) {
      assert(_store === store);
      assert(this instanceof C);
      count++;
    }

    // TODO: test activated and deactivated hooks
    C = connect(null, null, {
      beforeCreate: _assert,
      created: _assert,
      beforeDestroy: _assert,
      destroyed: _assert,
      beforeMount: _assert,
      mounted: _assert,
      beforeUpdate: _assert,
      updated: _assert
    })('example', Component);

    const c = mountContainer(store, C);
    store.dispatch('UPDATE_FOO', 'foo');
    c.$forceUpdate();

    Vue.nextTick(() => {
      c.$destroy();
      assert(count === 8);
      done();
    });
  });

  it('does not allow other than lifecycle hooks', () => {
    const C = connect({
      a: 'foo'
    }, {
      b: 'bar'
    }, {
      a: 1,
      b: 1,
      methods: {
        c: () => 1
      },
      vuex: {
        getters: {
          a: s => s.bar,
          d: () => 1
        },
        actions: {
          b: s => s.state.foo,
          e: () => 1
        }
      }
    })('example', Component);

    const c = mountContainer(store, C);

    assert(c.a === store.getters.foo);
    assert(typeof c.b === 'function');
    assert(c.c === void 0);
    assert(c.d === void 0);
    assert(c.e === void 0);
    assert(c.foo === void 0);
  });

  it('passes container props to component props if no getters and actions are specified', () => {
    const C = connect({
      a: 'foo',
      b: 'bar'
    })('example', Component);

    const c = mountContainer(store, C, { a: 1, c: 'test' });

    assert(c.a === 'bar'); // should not override container props
    assert(c.b === 5);
    assert(c.c === 'test');
  });

  it('accepts component options for wrapped component', () => {
    const C = connect({
      a: 'foo'
    }, {
      c: 'foo'
    })('example', options);

    const c = mountContainer(store, C);

    assert(c.a === 'bar');
    c.c('baz');
    assert(c.a === 'baz');
  });
});

function mountContainer(store, Container, props) {
  const app = new Vue({
    el: '#app',
    store,
    render: h => h(Container, { props })
  });
  return app.$children[0];
}
