{pkgs}: {
  deps = [
    pkgs.dbus
    pkgs.alsa-lib
    pkgs.mesa
    pkgs.libdrm
    pkgs.xorg.libXext
    pkgs.xorg.libX11
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.gdk-pixbuf
    pkgs.gtk3
    pkgs.glib
    pkgs.pango
    pkgs.cairo
    pkgs.expat
    pkgs.cups
    pkgs.atk
    pkgs.nss
    pkgs.chromium
    pkgs.pnpm
    pkgs.unzip
  ];
}
