# Maintainer: VannRR <https://github.com/vannrr>
pkgname=omarchy-firefox-theme
pkgver=1.1.0
pkgrel=1
pkgdesc="Firefox extension plus native helper that dynamically themes Firefox to your current omarchy theme."
arch=('x86_64')
OPTIONS=('!splitdebug')
url="https://github.com/vannrr/omarchy-firefox-theme"
license=('Apache-2.0' 'BSD' 'MIT')
depends=()
makedepends=('gcc' 'nodejs' 'npm' 'zip')
optdepends=(
	"firefox: Enable extension for Firefox"
	"librewolf: Enable extension for LibreWolf"
	"floorp: Enable extension for Floorp"
)
source=("LICENSE")
sha256sums=('SKIP')

# Files and locations used by the package
_binary_name="omarchy-firefox-themehost"
_manifest_basename="io.vannrr.omarchy_firefox_theme.json"
_xpi_name="io.vannrr.omarchy_firefox_theme@local.xpi"
libdir="/usr/lib"
native_manifest_dir="${libdir}/mozilla/native-messaging-hosts"
firefox_ext_path="${libdir}/firefox/browser/extensions"
librewolf_ext_path="${libdir}/librewolf/browser/extensions"
floorp_ext_path="${libdir}/floorp/browser/extensions"

build() {
	pushd "${srcdir}/.." || return 1

	# Build native helper
	mkdir -p "${srcdir}/native"
	gcc -O2 -pipe -std=c11 -Wall -Wextra -o "${srcdir}/native/${_binary_name}" native/main.c
	cp "native/manifest.json" "${srcdir}/native"

	# Build webextension (install node deps and run build)
	cd extension || return 1
	npm i --no-audit --no-fund
	mkdir -p "${srcdir}/extension"
	npx esbuild src/background.js --bundle --outfile="${srcdir}/extension/background.js" --platform=browser --sourcemap
	cp 'icon-32.png' 'icon-64.png' 'manifest.json' "${srcdir}/extension"

	# Create XPI from extension and place it in srcdir for package()
	cd "${srcdir}/extension" || return 1
	zip -r -q "${srcdir}/${_xpi_name}" .
	rm -rf "${srcdir}/extension"

	popd || return 1
}

package() {
	# Install native helper binary
	install -Dm0755 "native/${_binary_name}" "${pkgdir}/${libdir}/${_binary_name}"

	# Install native messaging manifest
	install -d "${pkgdir}${native_manifest_dir}"
	install -Dm0644 "native/manifest.json" "${pkgdir}/${native_manifest_dir}/${_manifest_basename}"

	# Install extension XPI for Firefox, LibreWolf and Floorp
	install -d "${pkgdir}${firefox_ext_path}"
	install -Dm0644 "${srcdir}/${_xpi_name}" "${pkgdir}/${firefox_ext_path}/${_xpi_name}"

	install -d "${pkgdir}${librewolf_ext_path}"
	install -Dm0644 "${srcdir}/${_xpi_name}" "${pkgdir}/${librewolf_ext_path}/${_xpi_name}"

	install -d "${pkgdir}${floorp_ext_path}"
	install -Dm0644 "${srcdir}/${_xpi_name}" "${pkgdir}/${floorp_ext_path}/${_xpi_name}"

	# Install license
	install -Dm0644 LICENSE "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"
}
