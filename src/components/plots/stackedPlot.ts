///<reference path="../../reference.ts" />

module Plottable {
export module Abstract {

  interface StackedDatum {
    key: any;
    value: number;
    offset?: number;
  }

  export class Stacked<X, Y> extends Abstract.NewStylePlot<X, Y> {

    private stackedExtent = [0, 0];
    public _isVertical: boolean;

    public _onDatasetUpdate() {
      super._onDatasetUpdate();
      // HACKHACK Caused since onDataSource is called before projectors are set up.  Should be fixed by #803
      if (this._datasetKeysInOrder && this._projectors["x"]  && this._projectors["y"]) {
        this.stack();
      }
    }

    private stack() {
      var datasets = this._getDatasetsInOrder();
      var keyAccessor = this._isVertical ? this._projectors["x"].accessor : this._projectors["y"].accessor;
      var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;

      var dataMapArray = this.generateDefaultMapArray();

      var positiveDataMapArray: D3.Map<StackedDatum>[] = dataMapArray.map((dataMap: D3.Map<StackedDatum>) => {
        return _Util.Methods.populateMap(dataMap.keys(), (key: string) => {
          return {key: key, value: Math.max(0, dataMap.get(key).value)};
        });
      });

      var negativeDataMapArray: D3.Map<StackedDatum>[] = dataMapArray.map((dataMap) => {
        return _Util.Methods.populateMap(dataMap.keys(), (key) => {
          return {key: key, value: Math.min(dataMap.get(key).value, 0)};
        });
      });

      this.setDatasetStackOffsets(this._stack(positiveDataMapArray), this._stack(negativeDataMapArray));

      var maxStack = _Util.Methods.max(datasets, (dataset: Dataset) => {
        return _Util.Methods.max(dataset.data(), (datum: any) => {
          return valueAccessor(datum) + datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"];
        });
      });

      var minStack = _Util.Methods.min(datasets, (dataset: Dataset) => {
        return _Util.Methods.min(dataset.data(), (datum: any) => {
          return valueAccessor(datum) + datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"];
        });
      });

      this.stackedExtent = [Math.min(minStack, 0), Math.max(0, maxStack)];
    }

    /**
     * Feeds the data through d3's stack layout function which will calculate
     * the stack offsets and use the the function declared in .out to set the offsets on the data.
     */
    private _stack(dataArrayMap: D3.Map<StackedDatum>[]): D3.Map<StackedDatum>[] {
      var outFunction = (d: StackedDatum, y0: number, y: number) => {
        d.offset = y0;
      };

      d3.layout.stack()
               .x((d) => d.key)
               .y((d) => d.value)
               .values((d) => d.values())
               .out(outFunction)(dataArrayMap);

      return dataArrayMap;
    }

    /**
     * After the stack offsets have been determined on each separate dataset, the offsets need
     * to be determined correctly on the overall datasets
     */
    private setDatasetStackOffsets(positiveDataMapArray: D3.Map<StackedDatum>[], negativeDataMapArray: D3.Map<StackedDatum>[]) {
      var keyAccessor = this._isVertical ? this._projectors["x"].accessor : this._projectors["y"].accessor;
      var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;

      this._getDatasetsInOrder().forEach((dataset, datasetIndex) => {
        var positiveDataMap = positiveDataMapArray[datasetIndex];
        var negativeDataMap = negativeDataMapArray[datasetIndex];

        dataset.data().forEach((datum: any, datumIndex: number) => {
          var positiveOffset = positiveDataMap.get(keyAccessor(datum)).offset;
          var negativeOffset = negativeDataMap.get(keyAccessor(datum)).offset;

          datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"] = valueAccessor(datum) > 0 ? positiveOffset : negativeOffset;
        });
      });
    }

    private generateDefaultMapArray(): D3.Map<StackedDatum>[] {
      var domainKeys = d3.set();

      var keyAccessor = this._isVertical ? this._projectors["x"].accessor : this._projectors["y"].accessor;
      var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;

      var datasets = this._getDatasetsInOrder();
      datasets.forEach((dataset) => {
        dataset.data().forEach((datum) => {
          domainKeys.add(keyAccessor(datum));
        });
      });

      var dataMapArray = datasets.map(() => {
        return _Util.Methods.populateMap(domainKeys.values(), (domainKey) => {
          return {key: domainKey, value: this._missingValue()};
        });
      });

      datasets.forEach((dataset, datasetIndex) => {
        dataset.data().forEach((datum) => {
          var key = keyAccessor(datum);
          var value = valueAccessor(datum);
          dataMapArray[datasetIndex].set(key, {key: key, value: value});
        });
      });

      return dataMapArray;
    }

    public _updateScaleExtents() {
      super._updateScaleExtents();
      var primaryScale: Abstract.Scale<any,number> = this._isVertical ? this._yScale : this._xScale;
      if (!primaryScale) {
        return;
      }
      if (this._isAnchored && this.stackedExtent.length > 0) {
        primaryScale._updateExtent(this._plottableID.toString(), "_PLOTTABLE_PROTECTED_FIELD_STACK_EXTENT", this.stackedExtent);
      } else {
        primaryScale._removeExtent(this._plottableID.toString(), "_PLOTTABLE_PROTECTED_FIELD_STACK_EXTENT");
      }
    }

    public _missingValue(): number {
      return 0;
    }
  }
}
}
