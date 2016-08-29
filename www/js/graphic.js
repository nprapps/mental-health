// Map of functions that correspond with state numbers
var eventsMap = {
    0: 'initIcons',
    1: 'showHighlightedIcons',
    2: 'consolidateHighlightedIcons',
    3: 'showOnlyHighlighted',
    4: 'narrowDownHighlighted',
    5: 'consolidateSmallestSet'
};

var graphicsMap = {
    '#graphic-0': null,
    '#graphic-1': null,
    '#graphic-2': null
};

$(document).ready(function() {
    $.each(graphicsMap, function(gId) {
        render(gId);
    });

    $('.slide').on('graphic:visible', function(e) {
        // TODO standardize your jquery vs d3 use!
        var graphicId = $(this).find('.graphic').attr('id');
        if (graphicId) {
            var nextStateStr = $(this).find('.graphic').attr('data-next');
            var nextStateArray = nextStateStr ? nextStateStr.split(',') : null;
            var currentGraphic = graphicsMap['#' + graphicId];
            var containerWidth = $('#' + graphicId).width();

            currentGraphic.updateLayout(containerWidth, nextStateArray);
        }
    });
});

/*
 * Initialize all graphics
 */
var render = function(containerSelector) {
    // Render the chart!
    var graphicElement = d3.select(containerSelector);
    var containerWidth = parseInt(graphicElement.style('width'));
    var initState = graphicElement.attr('data-state');
    var thisGraphic;

    var updateLayout = _.debounce(function() {
        containerWidth = parseInt(graphicElement.style('width'));
        var nextStateStr = graphicElement.attr('data-next');
        var nextStateArray = nextStateStr ? nextStateStr.split(',') : null;
        thisGraphic.updateLayout(containerWidth, nextStateArray);
    }, 200);

    thisGraphic = initGraphic({
        container: containerSelector,
        width: containerWidth,
        initState: initState || 0
    });

    graphicsMap[containerSelector] = thisGraphic;

    window.addEventListener('resize', updateLayout, false);
}

/*
 * Render a graphic.
 */
var initGraphic = function(config) {
    var self = {};
    var margins,
        chartWidth, chartHeight,
        numItems, rowItems, itemPadding, itemAspect, itemWidth, itemHeight,
        iconWidth, scaleRatio;

    self.calculateLayout = function() {
        margins = {
            top: 0,
            right: 15,
            bottom: 20,
            left: 15
        };

        // Calculate actual chart dimensions
        chartWidth = config['width'] - margins['left'] - margins['right'];

        // Start by assuming a biggish screen. We will eventually come up with several widths, maybe?
        numItems = 200;
        rowItems = 20;
        itemPadding = 8;
        itemAspect = 170/120;
        itemWidth = (chartWidth / rowItems) - itemPadding - itemPadding;
        itemHeight = itemAspect * itemWidth;
        chartHeight = (numItems / rowItems) * (itemHeight + itemPadding + itemPadding);

        iconWidth = 86; // I DON'T KNOW WHAT TO DO ABOUT THIS
        scaleRatio = itemWidth / iconWidth;
    }

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    self.calculateLayout();

    // Create container
    var svgElement = containerElement.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom']);

    var svgDefs = svgElement.append('defs');
    var defPrefix = config['container'].slice(1) + '-icon-';

    // Add icons as defs
    for (var i=1; i<=5; i++) {
        var iconDef = d3.select('#svg-defs').select('#silhouette-'+ i).node().cloneNode(true);
        var appendedDef = svgDefs.node()
            .appendChild(iconDef);

        d3.select(appendedDef)
            .attr('id', defPrefix + i);
    }

    var chartElement = svgElement.append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    // Draw here!
    var iconsGroup = chartElement.append('g')
        .attr('class', 'icons-g');

    self.updateLayout = function(containerWidth, nextArray) {
        config['width'] = containerWidth;
        self.calculateLayout();

        svgElement
            .attr('width', chartWidth + margins['left'] + margins['right'])
            .attr('height', chartHeight + margins['top'] + margins['bottom']);

        chartElement
            .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

        iconsGroup.html('');

        self.triggerStates(nextArray);
    }

    // Add icons for initial state
    self.initIcons = function() {
        iconsGroup.classed('highlight-visible', false);
        iconsGroup.classed('highlight-2-visible', false);
        iconsGroup.classed('non-invisible', false);

        iconsGroup.selectAll('.icon')
            .data(ICON_DATA)
                .enter()
            .append('g')
                .attr('class', function(d,i) {
                    if (d['highlight']) {
                        if (d['highlight_2']) {
                            return 'icon icon-highlight icon-highlight-2';
                        } else {
                            return 'icon icon-highlight icon-highlight-2-non';
                        }
                    } else {
                        return 'icon icon-non';
                    }
                })
                .attr('transform', function(d,i) {
                    var xPos = _getXPositionInGrid(rowItems, i);
                    var yPos = _getYPositionInGrid(rowItems, i);
                    return 'translate(' + xPos + ',' + yPos + ')';
                })
                .append('use')
                    .attr('xlink:href', function(d) {
                        var imgNum = parseInt(d['img_num'], 10);
                        return '#' + defPrefix + imgNum;
                    })
                    .attr('transform', 'scale(' + scaleRatio + ')');
    };

    // Show the highlighted icons
    self.showHighlightedIcons = function() {
        iconsGroup
            .classed('highlight-visible', true);
    };

    // Move the highlighted icons into one consolidated bar
    self.consolidateHighlightedIcons = function() {
        var highlightedItems = rowItems * 0.2;
        var nonItems = rowItems - highlightedItems;

        iconsGroup.classed('highlight-visible', true);

        chartElement.selectAll('.icon-highlight')
            .transition()
                .duration(1500)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(highlightedItems, i);
                var yPos = _getYPositionInGrid(highlightedItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });

        var nonOffset = highlightedItems * (itemWidth + itemPadding + itemPadding);

        chartElement.selectAll('.icon-non')
            .transition()
                .duration(1500)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(nonItems, i, nonOffset);
                var yPos = _getYPositionInGrid(nonItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });
    };

    self.showOnlyHighlighted = function() {
        iconsGroup.classed('highlight-visible', true);
        iconsGroup.classed('non-invisible', true);
    };

    self.narrowDownHighlighted = function() {
        iconsGroup.classed('highlight-2-visible', true);
    };

    self.consolidateSmallestSet = function() {
        var highlightedItems = rowItems * 0.8;
        var nonItems = rowItems - highlightedItems;

        chartElement.selectAll('.icon-highlight-2')
            .transition()
                .duration(1500)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(highlightedItems, i);
                var yPos = _getYPositionInGrid(highlightedItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });

        var nonOffset = highlightedItems * (itemWidth + itemPadding + itemPadding);

        chartElement.selectAll('.icon-highlight-2-non')
            .transition()
                .duration(1500)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(nonItems, i, nonOffset);
                var yPos = _getYPositionInGrid(nonItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });
    };

    self.triggerStates = function(nextArray) {
        self.initIcons();

        // Run the function corresponding to the current state
        if (nextArray) {
            nextArray.forEach(function(v,i) {
                var transitionDelay = 2000;
                _.delay(self[eventsMap[v]], transitionDelay*i);
            });
        }
    }

    // Some private helper functions
    var _getXPositionInGrid = function(setItems, itemIndex, offset) {
        var offset = offset || 0;
        var colNum = itemIndex - (setItems * Math.floor(itemIndex / setItems));
        return (colNum * (itemWidth + itemPadding + itemPadding)) + itemPadding + offset;
    }

    var _getYPositionInGrid = function(setItems, itemIndex, offset) {
        var offset = offset || 0;
        var rowNum = Math.floor(itemIndex / setItems);
        return (rowNum * (itemHeight + itemPadding + itemPadding)) + itemPadding + offset;
    }

    self.chartElement = chartElement;
    self.triggerStates([config['initState']]);

    return self;
}

