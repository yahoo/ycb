# Yahoo! Configuration Bundle

[![Build Status](https://secure.travis-ci.org/yahoo/ycb.png?branch=master)](http://travis-ci.org/yahoo/ycb)

YCB is a multi-dimensional configuration library that builds bundles from resource files describing a variety of values. The library allows applications to configure themselves based on multiple dimensions describing locations, languages, environments, etc.

### Install

`npm install ycb --save`

### Usage

```
var YCB = require('ycb');
var configArray = [
    {
        dimensions: [
            {
                environment: {
                    dev: null,
                    staging: null,
                    test: null,
                    prod: null
                },
            },
            {
                device: {
                    desktop: null,
                    mobile: {
                        tablet: null,
                        smartphone: null
                    }
                }
            }
        ]
    },
    {
        settings: ["master"],
        host: "example.com",
        prefix: null
    },
    {
        settings: ["environment:dev"],
        host: "dev.example.com"
    },
    {
        settings: ["environment:staging,test"],
        host: "stage.example.com"
    },
    {
        settings: ["device:smartphone"],
        prefix: 'm.'
    }
];

var ycbObj = new YCB.Ycb(configArray);
var computedConfig = ycbObj.read({ environment: 'dev' });

console.log(computedConfig.host); // dev.example.com
```
### Scheduling Changes
We can schedule configuration changes ahead of time by defining an interval along with a config and using the time aware read method. For example the following program
```
var YCB = require('ycb');
var configArray = [
    {
        dimensions: [
            {
                environment: {
                    dev: null,
                    staging: null,
                    test: null,
                    prod: null
                },
            },
            {
                region: {
                    us: null,
                    ca: null
                }
            }
        ]
    },
    {
        settings: ["master"],
        host: "example.com"
    },
    {
        settings: {
            dimensions: ["region:us"]
        },
        logo: "logo.png"
    },
    {
        settings: {
            dimensions: ["region:us"],
            schedule: {
                start: "2019-11-28T00:04:00Z",
                end: "2019-11-29T00:04:00Z"
            }
        },
        logo: "thanksgiving-logo.png"
    }
];

var ycbObj = new YCB.Ycb(configArray, {cacheInfo:true});
var config1 = ycbObj.readTimeAware({region:'us'}, 0);
var config2 = ycbObj.readTimeAware({region:'us'}, 1574899440000);
var config3 = ycbObj.readTimeAware({region:'us'}, 1574985840001);
console.log(config1);
console.log(config2);
console.log(config3);
```
will print
```
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
