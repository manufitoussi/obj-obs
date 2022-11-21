import { equal, ok } from 'assert';
import ObjObs from '../src/obj-obs.js';

describe('ObjObs Tests', () => {
  it('ObjObs instance', () =>  {
    const obs = new ObjObs();
    ok(obs);
    ok(obs._observed);
    ok(obs.observe);
    ok(obs.unobserve);
    ok(obs.resolve);
    ok(obs.set);
    ok(obs.get);
    ok(obs.notify);
  });

  // TODO test set
  // TODO test get

  it('property observation', () =>  {
    const obs = new ObjObs();
    const test1 = {
      propA: 1,
      propB: 2,
    };

    const results = [];
    const callback1 = (args) => {
      results.push({ name: 'callback1', ...args });
    };
    
    const callback2 = (args) => {
      results.push({ name: 'callback2', ...args });
    };

    obs.observe(test1, 'propA', callback1);
    const pathEntries = obs._observed.get(test1);
    equal(pathEntries.size, 1, '1 entrie');

    const callbackEntries = pathEntries.get('propA');
    equal(callbackEntries.size, 1, '1 entrie');

    obs.set(test1, 'propA', 3);
    equal(results[0].name, 'callback1');
    equal(results[0].object, test1);
    equal(results[0].key, 'propA');
    equal(results[0].oldValue, 1);
    equal(results[0].newValue, 3);
    equal(results[0].origin.object.deref(), test1);
    equal(results[0].origin.path, 'propA');
    equal(results[0].origin.oPath, '');
    

    obs.observe(test1, 'propA', callback2);    
    equal(callbackEntries.size, 2, '2 entries');

    obs.set(test1, 'propA', 4);
    equal(results[1].name, 'callback1');
    equal(results[2].name, 'callback2');

    obs.unobserve(test1, 'propA', callback1);
    equal(callbackEntries.size, 1, '1 entrie');
    obs.set(test1, 'propA', 5);
    equal(results[3].name, 'callback2');
    equal(results.length, 4);


    obs.unobserve(test1, 'propA', callback2);
    equal(callbackEntries.size, 0, '0 entrie');
    obs.set(test1, 'propA', 5);
    equal(results.length, 4);

  });

  it('properties observation', () =>  {
    const obs = new ObjObs();
    const test1 = {
      propA: 1,
      propB: 2,
    };

    const results = [];
    const callback1 = (args) => {
      results.push({ name: 'callback1', ...args });
    };
    
    const callback2 = (args) => {
      results.push({ name: 'callback2', ...args });
    };

    obs.observe(test1, 'propA', callback1);
    obs.observe(test1, 'propB', callback2);
    const pathEntries = obs._observed.get(test1);
    equal(pathEntries.size, 2, '2 entries');

    const callbackEntriesA = pathEntries.get('propA');
    equal(callbackEntriesA.size, 1, '1 entrie');

    const callbackEntriesB = pathEntries.get('propB');
    equal(callbackEntriesB.size, 1, '1 entrie');

    obs.set(test1, 'propA', 3);
    equal(results[0].name, 'callback1');
    obs.set(test1, 'propB', 4);
    equal(results[1].name, 'callback2');
    equal(results[1].key, 'propB');

    obs.unobserve(test1, 'propA', callback1);
    equal(callbackEntriesA.size, 0, '0 entrie');
  });

  // TODO test notify

  it('path observation', () =>  {
    const obs = new ObjObs();
    const test1 = {
      a: {
        _n: "a",
        _v: 1,
        b: {
          _n: "b",
          _v: 1,
          c: {
            _n: "c",
            _v: 1,
            d: 1
          }
        }
      }
    };
    const results = [];
    const callback1 = (args) => {
      results.push({ name: 'callback1', ...args });
    };
    
    const callback2 = (args) => {
      results.push({ name: 'callback2', ...args });
    };

    obs.observe(test1, 'a.b.c.d', callback1);
    ok(obs._observed.get(test1));
    ok(obs._observed.get(test1.a));
    ok(obs._observed.get(test1.a.b));
    ok(obs._observed.get(test1.a.b.c));
    
    obs.set(test1, 'a.b.c.d', 2);
    equal(results[0].name, 'callback1');
    equal(results[0].object, test1.a.b.c);
    equal(results[0].key, 'd');
    equal(results[0].oldValue, 1);
    equal(results[0].newValue, 2);
    equal(results[0].origin.object.deref(), test1);
    equal(results[0].origin.path, 'a.b.c.d');
    equal(results[0].origin.oPath, 'a.b.c');
    
    obs.unobserve(test1, 'a.b.c.d', callback1);
    equal(obs._observed.get(test1).size, 1);
    equal(obs._observed.get(test1).get('a').size, 0);
    equal(obs._observed.get(test1.a).size, 1);
    equal(obs._observed.get(test1.a).get('b').size, 0);
    equal(obs._observed.get(test1.a.b).size, 1);
    equal(obs._observed.get(test1.a.b).get('c').size, 0);
    equal(obs._observed.get(test1.a.b.c).size, 1);
    equal(obs._observed.get(test1.a.b.c).get('d').size, 0);
    obs.set(test1, 'a.b.c.d', 3);
    equal(results.length, 1);
    equal(test1.a.b.c.d, 3);

  });

  it('paths observation', () =>  {
    const obs = new ObjObs();
    const test1 = {
      a: {
        _n: "a",
        _v: 1,
        b: {
          _n: "b",
          _v: 1,
          c: {
            _n: "c",
            _v: 1,
            d: 1
          },
          e: {
            _n: "e",
            _v: 1,
            f: 1
          }
        }
      }
    };
    const results = [];
    const callback1 = (args) => {
      results.push({ name: 'callback1', ...args });
    };
    
    const callback2 = (args) => {
      results.push({ name: 'callback2', ...args });
    };

    obs.observe(test1, 'a.b.c.d', callback1);
    obs.observe(test1, 'a.b.e.f', callback2);

    const bV1 = obs.get(test1, 'a.b');
    const bV2 = {
      _n: "b",
      _v: 2,
      c: { _n: "c", d: 3, _v: 2 },
      e: { _n: "e", f: 3, _v: 2 }
    };

    obs.set(test1, 'a.b', bV2);
    equal(results[0].name, 'callback1');
    equal(results[0].object, test1.a);
    equal(results[0].key, 'b');
    equal(results[0].oldValue, bV1);
    equal(results[0].newValue, bV2);
    equal(results[0].origin.object.deref(), test1);
    equal(results[0].origin.path, 'a.b.c.d');
    equal(results[0].origin.oPath, 'a');


    equal(results[1].name, 'callback2');
    equal(results[1].object, test1.a);
    equal(results[1].key, 'b');
    equal(results[1].oldValue, bV1);
    equal(results[1].newValue, bV2);
    equal(results[1].origin.object.deref(), test1);
    equal(results[1].origin.path, 'a.b.e.f');
    equal(results[1].origin.oPath, 'a');

    obs.set(test1, 'a.b.c.d', 4);
    equal(results.length, 3);
    equal(results[2].name, 'callback1');
    equal(results[2].object, test1.a.b.c);
    equal(results[2].key, 'd');
    equal(results[2].oldValue, 3);
    equal(results[2].newValue, 4);
    equal(results[2].origin.object.deref(), test1);
    equal(results[2].origin.path, 'a.b.c.d');
    equal(results[2].origin.oPath, 'a.b.c');
    
    
    
    obs.set(test1, 'a.b.e.f', 4);
    equal(results.length, 4);
    equal(results[3].name, 'callback2');
    equal(results[3].object, test1.a.b.e);
    equal(results[3].key, 'f');
    equal(results[3].oldValue, 3);
    equal(results[3].newValue, 4);
    equal(results[3].origin.object.deref(), test1);
    equal(results[3].origin.path, 'a.b.e.f');
    equal(results[3].origin.oPath, 'a.b.e');
    
    obs.set(bV1, 'c.d', 5);
    equal(results.length, 4);

  });
});