# Yahoo! Configuration Bundle

![Build Status](https://github.com/yahoo/ycb/actions/workflows/node.js.yml/badge.svg)

YCB is a multi-dimensional configuration library that builds bundles from resource files describing a variety of values. The library allows applications to configure themselves based on multiple dimensions describing locations, languages, environments, etc.

### Install

`npm install ycb --save`

### Usage

```js
import YCB from 'ycb';
const configArray = [
    {
        dimensions: [
            {
                environment: {
                    dev: null,
                    staging: null,
                    test: null,
                    prod: null,
                },
            },
            {
                device: {
                    desktop: null,
                    mobile: {
                        tablet: null,
                        smartphone: null,
                    },
                },
            },
        ],
    },
    {
        settings: ['main'],
        host: 'example.com',
        prefix: null,
    },
    {
        settings: ['environment:dev'],
        host: 'dev.example.com',
    },
    {
        settings: ['environment:staging,test'],
        host: 'stage.example.com',
    },
    {
        settings: ['device:smartphone'],
        prefix: 'm.',
    },
];

const ycbObj = new YCB.Ycb(configArray);
const computedConfig = ycbObj.read({ environment: 'dev' });

console.log(computedConfig.host); // dev.example.com
```

### Scheduling Changes

We can schedule configuration changes ahead of time by defining an interval along with a config and using the time aware read method. For example the following program.

```js
import YCB from 'ycb';
const configArray = [
    {
        dimensions: [
            {
                environment: {
                    dev: null,
                    staging: null,
                    test: null,
                    prod: null,
                },
            },
            {
                region: {
                    us: null,
                    ca: null,
                },
            },
        ],
    },
    {
        settings: ['main'],
        host: 'example.com',
    },
    {
        settings: {
            dimensions: ['region:us'],
        },
        logo: 'logo.png',
    },
    {
        settings: {
            dimensions: ['region:us'],
            schedule: {
                start: '2019-11-28T00:04:00Z',
                end: '2019-11-29T00:04:00Z',
            },
        },
        logo: 'thanksgiving-logo.png',
    },
];

const ycbObj = new YCB.Ycb(configArray, { cacheInfo: true });
const config1 = ycbObj.readTimeAware({ region: 'us' }, 0);
const config2 = ycbObj.readTimeAware({ region: 'us' }, 1574899440000);
const config3 = ycbObj.readTimeAware({ region: 'us' }, 1574985840001);
console.log(config1);
console.log(config2);
console.log(config3);
```

will print

```js
{ host: 'example.com',
  logo: 'logo.png',
  __ycb_expires_at__: 1574899440000 }
{ host: 'example.com',
  logo: 'thanksgiving-logo.png',
  __ycb_expires_at__: 1574985840001 }
{ host: 'example.com', logo: 'logo.png' }
```

These intervals are closed and either `start` or `end` may be omitted to define a one sided interval.

To support proper cache expiration one may set the `cacheInfo` option, in which case the next time the config will change is added to the returned object.

### Examples

Examples are provided in [the tests directory](https://github.com/yahoo/ycb/tree/master/tests).

### License

BSD see LICENSE.txt
