/**
 * App toast overlay: a full-screen layer above every screen (camera included)
 * that never takes touches, with the toast at the bottom. Spread on a plain View
 * (pointerEvents on SafeAreaView is not reliable).
 */
export const toastLayer = {
  pointerEvents: 'none',
  style: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
} as const;
