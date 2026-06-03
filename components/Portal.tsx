import * as React from 'react';
import { View, StyleSheet } from 'react-native';

// A minimal keyed teleport (no extra dependency). <Portal> publishes its
// children to a single <PortalProvider> host mounted at the App root, where
// an in-tree overlay fills the full (screen-capture-secured) main window.
// This keeps ModalBox content rendered in the main activity window so the
// native FLAG_SECURE / iOS secure-canvas overlay covers it, unlike a separate
// RN <Modal> window.

type PortalMethods = {
    setNode: (key: string, children: React.ReactNode) => void;
    removeNode: (key: string) => void;
};

const PortalContext = React.createContext<PortalMethods | null>(null);

export const PortalProvider: React.FC<{ children?: React.ReactNode }> = ({
    children
}) => {
    const [nodes, setNodes] = React.useState<Record<string, React.ReactNode>>(
        {}
    );

    const methods = React.useMemo<PortalMethods>(
        () => ({
            setNode: (key, node) =>
                setNodes((prev) => ({ ...prev, [key]: node })),
            removeNode: (key) =>
                setNodes((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                })
        }),
        []
    );

    return (
        <PortalContext.Provider value={methods}>
            {children}
            {/* Rendered after children so portalled content paints above the
                app; box-none keeps an empty host touch-transparent. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {Object.keys(nodes).map((key) => (
                    <React.Fragment key={key}>{nodes[key]}</React.Fragment>
                ))}
            </View>
        </PortalContext.Provider>
    );
};

let portalCounter = 0;

export const Portal: React.FC<{ children?: React.ReactNode }> = ({
    children
}) => {
    const ctx = React.useContext(PortalContext);
    const [key] = React.useState(() => `portal-${portalCounter++}`);

    // Publish on mount and re-publish on every update so a picker's setState
    // flows through to the root-mounted node.
    React.useEffect(() => {
        ctx?.setNode(key, children);
    });

    // Remove from the host only when this Portal unmounts.
    React.useEffect(() => () => ctx?.removeNode(key), [ctx, key]);

    return null;
};
