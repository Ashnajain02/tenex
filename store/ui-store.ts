import { create } from "zustand";

type DrawerTab = "files" | "preview";

interface UIState {
  sidebarOpen: boolean;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  drawerWidth: number;
  fileBrowserPath: string | null;
  previewUrl: string | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  setDrawerTab: (tab: DrawerTab) => void;
  setDrawerWidth: (width: number) => void;
  setFileBrowserPath: (path: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
  openDrawerTo: (tab: DrawerTab) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  drawerOpen: false,
  drawerTab: "files",
  drawerWidth: 400,
  fileBrowserPath: null,
  previewUrl: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setDrawerTab: (tab) => set({ drawerTab: tab }),
  setDrawerWidth: (width) => set({ drawerWidth: Math.max(280, Math.min(800, width)) }),
  setFileBrowserPath: (path) => set({ fileBrowserPath: path }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  openDrawerTo: (tab) => set({ drawerOpen: true, drawerTab: tab }),
}));
