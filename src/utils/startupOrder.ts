// @ajan: cursor · @etiket: katman-3, startup-order
/**
 * Await startup actions (errors logged, not thrown), then always init main window.
 * Order: dispatch-start → dispatch-end/reject → main-window-init.
 */
export async function runProgramStartupThenMainWindow(
  dispatch: () => Promise<unknown>,
  loadWindow: () => Promise<void>,
  onError: (err: unknown) => void,
): Promise<void> {
  try {
    await dispatch();
  } catch (err) {
    onError(err);
  }
  await loadWindow();
}
