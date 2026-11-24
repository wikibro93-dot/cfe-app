// Shared mock functions for component tests.
//
// jest.mock factories require() this module lazily (inside the factory),
// so the mocks exist by the time any factory runs — this avoids the
// "Cannot access 'mockX' before initialization" error that happens when
// a factory references a top-level const from the test file while the
// components under test import the mocked module.

export const mockSetTheme = jest.fn();
export const mockUseTheme = jest.fn(() => ({
  theme: "light",
  setTheme: mockSetTheme,
  resolvedTheme: "light",
}));
export const mockUseAppStore = jest.fn();
export const mockUsePathname = jest.fn(() => "/feed");
export const mockRouterReplace = jest.fn();
export const mockRouterPush = jest.fn();
export const mockApiGet = jest.fn();
