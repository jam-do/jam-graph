# jam-graph

## Super-simple and super-light (~1Kb gzip) graph-data manager

### Usage example

```js
import { Cluster } from 'jam-graph';

// Create new graph cluster:
const myGraph = new Cluster();

// Add label handler 
myGraph.subscribeOnLabel('UNLABELED', (idList) => {
  console.log(idList);
  console.log(myGraph.getVtxList(idList));
});

// Add first vertex:
const id1 = myGraph.addValue({
  myDataField: 'EXAMPLE 1',
});

// Add second vertex:
const id2 = myGraph.addValue({
  myDataField: 'EXAMPLE 2',
});

// Create edge:
myGraph.linkDuplex(id1, id2);
```

> Documentation will be updated and enhanced soon.
