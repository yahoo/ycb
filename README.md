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
    }
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

### Examples

Examples are provided in [the tests directory](https://github.com/yahoo/ycb/tree/master/tests).

### How does YCB work?

#### During Instantiation

When you create a YCB instance, YCB will parse each section of your configuration and create a map of lookup
keys to the dimension settings. 

Lookup keys are a string that contains an ordered, comma-separated list of dimension values. In this case,
there are only two dimensions: `environment` and `device`. `environment` is the first in the dimension list, so it 
has precedence over `device`.

Using these lookup key rules, the above config gets expanded into the following:

```js
ycb.settings = {
    // the all '*' key always contains the master settings
    '*/*': { host: 'example.com' },
    'dev/*': { host: 'dev.example.com' },
    'staging/*': { host: 'stage.example.com' },
    'test/*': { host: 'stage.example.com' }, // this is actually the same object as `staging/*` to save memory
    '*/mobile': { prefix: 'm.' }
};
```

Creating this list during instantiation allows use to do complex lookups relatively easy with any combination of 
dimension values.

#### During Read

Let's take an example `read` call in go through the steps of how it gets merged into a single configuration.

```js
var config = ycb.read({
    environment: 'prod',
    device: 'mobile'
});
```

The first step is creating a list of lookup keys that we can find in the settings cache. In this case, you may think 
that we just need to lookup `prod/mobile`, but you will see that this key doesn't exist in our cache. We need to find
the combinations of lookups that will satisfy all settings. Each dimension value has its own precedence hierarchy 
that we create a lookup list for:

```js
var lookupList = createLookupList({
    environment: 'prod',
    device: 'smartphone'
});
```
```js
{ 
    environment: ['prod', '*'], // inherits from master
    device: ['smartphone', 'mobile', '*'] // inherits from mobile and master
}
*/
```

From this lookup list, we expand it to all the combinations of values in precedence order:

`var lookupPaths = expandLookupList(lookupList);`
```js
[ '*/*',
  '*/mobile',
  '*/smartphone',
  'prod/*',
  'prod/mobile' ]
```

To optimize, we already know which dimension combinations are used in the configuration, so this can be reduced to:

```js
[ '*/*',
  '*/smartphone',
  'prod/*' ]
```

Now with this list we can simply merge settings using the list of lookup keys to get a single object:

```js
lookupPaths.reduce((config, key) => {
    return mergeDeep(ycb.settings[key], config);
}, {})
```
```js
{
    host: "example.com",
    prefix: 'm.'
}
*/
```

### License

BSD see LICENSE.txt
