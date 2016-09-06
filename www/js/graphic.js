// Map of functions that correspond with state numbers
var eventsMap = {
    0: 'initIcons',
    1: 'tileIcons',
    2: 'showHighlightedIcons',
    3: 'consolidateHighlightedIcons',
    4: 'showOnlyHighlighted',
    5: 'narrowDownHighlighted',
    6: 'consolidateSmallestSet'
};

var graphicsMap = {
    '#graphic-0': null,
    '#graphic-1': null,
    '#graphic-2': null
};

$(document).ready(function() {
    tweakSizing();

    $.each(graphicsMap, function(gId) {
        render(gId);
    });

    // Listen for a custom event fired in app.js on slide change
    $('.slide').on('graphic:visible', function(e) {
        // TODO standardize your jquery vs d3 use!
        var graphicId = $(this).find('.graphic').attr('id');

        // If there is a graphic that corresponds with the visible slide,
        // trigger the animations for ensuing states
        if (graphicId) {
            var nextStateStr = $(this).find('.graphic').attr('data-next');
            var nextStateArray = nextStateStr ? nextStateStr.split(',') : null;
            var currentGraphic = graphicsMap['#' + graphicId];
            var containerWidth = $('#' + graphicId).width();

            currentGraphic.updateLayout(containerWidth, nextStateArray);
        }
    });
});

var tweakSizing = function() {
    var slideParagraphHeight = $('#slide-01 p').height();
    $('#slide-02 p').height(slideParagraphHeight);
};

/*
 * Render initial graphic
 */
var render = function(containerSelector) {
    // Render the chart!
    var graphicElement = d3.select(containerSelector);
    var containerWidth = parseInt(graphicElement.style('width'));
    var initState = graphicElement.attr('data-state');
    var thisGraphic;

    // A debounced update function to redraw the chart on window resize
    var updateLayout = _.debounce(function() {
        tweakSizing();
        containerWidth = parseInt(graphicElement.style('width'));
        var nextStateStr = graphicElement.attr('data-next');
        var nextStateArray = nextStateStr ? nextStateStr.split(',') : null;
        thisGraphic.updateLayout(containerWidth, nextStateArray);
    }, 200);

    // The initGraphic function returns an object with references to the d3 selection
    // and public functions to reference in the global scope
    thisGraphic = initGraphic({
        container: containerSelector,
        width: containerWidth,
        initState: initState || 0
    });

    // Assign this to our graphicsMap
    graphicsMap[containerSelector] = thisGraphic;

    // Add a listener for resize to run the debounced update function
    window.addEventListener('resize', updateLayout, false);
}

/*
 * Initialize the graphic object, add to the DOM and set up layout functions
 */
var initGraphic = function(config) {
    var self = {};
    var margins,
        chartWidth, chartHeight,
        numItems, rowItems, itemPadding, itemAspect, itemWidth, itemHeight,
        iconWidth, scaleRatio;
    var isMobile;

    // Calculate layout variables like chart width, etc. that change on resize
    self.calculateLayout = function() {
        isMobile = config['width'] < 500 ? true : false;

        margins = {
            top: 20,
            right: 15,
            bottom: 20,
            left: 15
        };

        // Calculate actual chart dimensions
        chartWidth = config['width'] - margins['left'] - margins['right'];

        // Use a smaller set of icons on mobile
        numItems = isMobile ? 100 : 200;
        rowItems = isMobile ? 10 : 20;
        itemPadding = (chartWidth / rowItems) * 0.15;
        itemAspect = 180/120;
        itemWidth = (chartWidth / rowItems) - itemPadding - itemPadding;
        itemHeight = itemAspect * itemWidth;
        chartHeight = (numItems / rowItems) * (itemHeight + itemPadding + itemPadding);

        // Check to see if these calculations overflow the vertical viewport
        var containerOffset = $(config['container']).offset().top;
        var parentCell = $(config['container']).parent();
        var totalY = parentCell.outerHeight();
        var currentHeight = $(config['container']).find('svg').height() - margins['top'] - margins['bottom'] || chartHeight;
        var fitHeight = window.innerHeight - (totalY - currentHeight);

        if (chartHeight > fitHeight) {
            // If so, reverse-engineer the calculations to fit the height
            chartHeight = fitHeight;
            itemHeight = (fitHeight / (numItems / rowItems)) - itemPadding - itemPadding;
            itemWidth = itemHeight / itemAspect;
            chartWidth = (itemWidth + itemPadding + itemPadding) * rowItems;
        }

        iconWidth = 86; // Not ideal, but this is the pixel width of the SVG icons, for calculating the scale
        scaleRatio = itemWidth / iconWidth; // This will be used in a transform scale() attribute
    }

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    // Get layout calculations based on the current width
    self.calculateLayout();

    // Create container
    var svgElement = containerElement.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom']);

    // Add the svg icons one time as defs with ids unique to each graphic
    var svgDefs = svgElement.append('defs');
    var defPrefix = config['container'].slice(1) + '-icon-';

    // Append svg icons as defs
    for (var i=1; i<=5; i++) {
        var iconDef = d3.select('#svg-defs').select('#silhouette-'+ i).node().cloneNode(true);
        var appendedDef = svgDefs.node()
            .appendChild(iconDef);

        d3.select(appendedDef)
            .attr('id', defPrefix + i);
    }

    // Add the canvas for the chart!
    var chartElement = svgElement.append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    var iconsGroup = chartElement.append('g')
        .attr('class', 'icons-g');

    // Public wrapper for recalculating dimensions if necessary, redrawing chart and triggering animations
    self.updateLayout = function(containerWidth, nextArray) {
        config['width'] = containerWidth;
        self.calculateLayout();

        svgElement
            .attr('width', chartWidth + margins['left'] + margins['right'])
            .attr('height', chartHeight + margins['top'] + margins['bottom']);

        chartElement
            .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

        // Removing the group and re-appending it instead of clearing it.
        // Seems that IE and older Safari do not like using .html('') on SVG elements.
        chartElement.select('g.icons-g').remove();
        iconsGroup = chartElement.append('g')
            .attr('class', 'icons-g');

        self.triggerStates(nextArray);
    }

    // Add icons for initial state
    self.initIcons = function(showOnInit) {
        if (showOnInit) {
            iconsGroup.classed('init-hidden', false);
        } else {
            iconsGroup.classed('init-hidden', true);
        }
        iconsGroup.classed('highlight-visible', false);
        iconsGroup.classed('highlight-2-visible', false);
        iconsGroup.classed('non-invisible', false);

        // Use a subset of icons for small screens
        var iconData = ICON_DATA.slice(0, numItems);

        iconsGroup.selectAll('.icon')
            .data(iconData)
                .enter()
            .append('g')
                .attr('class', function(d,i) {
                    // Set up classes for various animations
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
                        // Grab the randomized icon filename from the spreadsheet icon data
                        var imgNum = parseInt(d['img_num'], 10);
                        return '#' + defPrefix + imgNum;
                    })
                    //.style('filter', 'url(#' + defPrefix + 'shadow')
                    .attr('transform', function() {
                        return 'scale(' + scaleRatio + ')';
                    });
    };

    // Stagger the appearance of icons, giving the effect of tiling them across the screen
    self.tileIcons = function() {
        iconsGroup.selectAll('.icon')
            .classed('init-hidden', true);

        iconsGroup.selectAll('.icon')
            .transition()
                .delay(function(d,i) {
                    return 1000 + (i * 20);
                })
                .each('start', function() {
                    d3.select(this)
                        .classed('init-hidden', false);
                });
    };

    // Show the highlighted icons for students with mental health disorders
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
                .duration(1000)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(highlightedItems, i);
                var yPos = _getYPositionInGrid(highlightedItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });

        var nonOffset = highlightedItems * (itemWidth + itemPadding + itemPadding);

        chartElement.selectAll('.icon-non')
            .transition()
                .duration(1000)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(nonItems, i, nonOffset);
                var yPos = _getYPositionInGrid(nonItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });
    };

    // Show only the highlighted icons, not the non-MH ones
    self.showOnlyHighlighted = function() {
        iconsGroup.classed('highlight-visible', true);
        iconsGroup.classed('non-invisible', true);
    };

    // Show the subset of icons for those not getting treatment
    self.narrowDownHighlighted = function() {
        iconsGroup.classed('highlight-2-visible', true);
    };

    // Take the icons representing those with mental health disorders and consolidate
    self.consolidateSmallestSet = function() {
        var highlightedItems = (rowItems / 2) * 0.8;
        var nonItems = (rowItems / 2) - highlightedItems;

        var subsetOffset = (rowItems / 4) * (itemWidth + itemPadding + itemPadding);

        chartElement.selectAll('.icon-highlight-2')
            .transition()
                .duration(1000)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(highlightedItems, i, subsetOffset);
                var yPos = _getYPositionInGrid(highlightedItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });

        var nonOffset = (highlightedItems * (itemWidth + itemPadding + itemPadding)) + subsetOffset;

        chartElement.selectAll('.icon-highlight-2-non')
            .transition()
                .duration(1000)
            .attr('transform', function(d,i) {
                var xPos = _getXPositionInGrid(nonItems, i, nonOffset);
                var yPos = _getYPositionInGrid(nonItems, i);
                return 'translate(' + xPos + ',' + yPos + ')';
            });
    };

    // Trigger state animations with some delay in between
    self.triggerStates = function(nextArray) {
        self.initIcons();

        // Run the function corresponding to the current state
        if (nextArray) {
            nextArray.forEach(function(v,i) {
                var transitionDelay = 1200;
                _.delay(self[eventsMap[v]], transitionDelay*i, true);
            });
        }
    }

    // Some private helper functions for positioning
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

    // Make the d3 element available globally, trigger animations and return this as an object
    self.chartElement = chartElement;
    self.triggerStates([config['initState']]);

    return self;
}

