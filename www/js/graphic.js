// Map of functions that correspond with state numbers
var eventsMap = {
    0: 'initIcons',
    1: 'showHighlightedIcons',
    2: 'consolidateHighlightedIcons'
};

var graphicsMap = {
    '#graphic-0': null,
    '#graphic-1': null
};

$(document).ready(function() {
    $.each(graphicsMap, function(gId) {
        render(gId);
    });

    $('.slide').on('graphic:visible', function(e) {
        // TODO standardize your jquery vs d3 use!
        var graphicId = $(this).find('.graphic').attr('id');
        if (graphicId) {
            var currentGraphic = graphicsMap['#' + graphicId];
            var containerWidth = $('#' + graphicId).width();
            currentGraphic.updateLayout(containerWidth);
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
    var nextState = graphicElement.attr('data-next');
    var thisGraphic;

    var updateLayout = _.debounce(function() {
        containerWidth = parseInt(graphicElement.style('width'));
        thisGraphic.updateLayout(containerWidth);
    }, 200);

    thisGraphic = initGraphic({
        container: containerSelector,
        width: containerWidth,
        initState: initState || 0,
        nextState: nextState || 0
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
        itemPadding = 5;
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
    for (var i=1; i<5; i++) {
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

    var selectedIndexes = [3,9,16,18,20,23,31,38,45,47,55,59,60,61,65,73,78,86,88,94,97,101,111,113,122,127,130,135,140,145,147,157,162,173,178,181,184,185,194,198];

    self.updateLayout = function(containerWidth) {
        config['width'] = containerWidth;
        self.calculateLayout();

        svgElement
            .attr('width', chartWidth + margins['left'] + margins['right'])
            .attr('height', chartHeight + margins['top'] + margins['bottom']);

        chartElement
            .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

        iconsGroup.html('');

        var currentState = config['nextState'] || config['initState'];
        self.triggerStates(currentState);
    }

    // Add icons for initial state
    self.initIcons = function() {
        iconsGroup.selectAll('.icon')
            .data(new Array(numItems))
                .enter()
            .append('g')
                .attr('class', function(d,i) {
                    if (_.indexOf(selectedIndexes, i) > -1) {
                        return 'icon icon-highlight';
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
                    .attr('xlink:href', function() {
                        var imgNum = Math.ceil(Math.random() * 4);
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

    self.triggerStates = function(initState, nextState) {
        self.initIcons();

        // Run the function corresponding to the current state
        if (initState && initState > 0) {
            var transitionDelay = 10;
            _.delay(self[eventsMap[initState]], transitionDelay);
        }

        if (nextState) {
            var transitionDelay = 50;
            _.delay(self[eventsMap[nextState]], transitionDelay);
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
    self.triggerStates(config['initState'], config['nextState']);

    return self;
}

