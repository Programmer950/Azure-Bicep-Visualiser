import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, direction = 'TB', spacing = 100) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: spacing,
        nodesep: spacing * 0.8
    });

    const nodeWidth = 200;
    const nodeHeight = 120;

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,

            targetPosition: direction === 'TB' ? 'top' : 'left',
            sourcePosition: direction === 'TB' ? 'bottom' : 'right',
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return { layoutedNodes, layoutedEdges: edges };
};