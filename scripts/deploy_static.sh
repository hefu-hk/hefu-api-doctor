#!/bin/sh
set -eu

DIST_DIR="${1:?usage: deploy_static.sh /absolute/path/to/dist [release-id]}"
RELEASE_ID="${2:-$(date -u +%Y%m%dT%H%M%S)}"
VOLUME_NAME="${FRONTEND_VOLUME:-ai-api_frontend_dist}"
case "$RELEASE_ID" in
  ""|*[!A-Za-z0-9_.-]*) echo "invalid release id" >&2; exit 1 ;;
esac
[ -s "$DIST_DIR/index.html" ] || { echo "missing dist/index.html" >&2; exit 1; }
[ -d "$DIST_DIR/assets" ] || { echo "missing dist/assets" >&2; exit 1; }

docker run --rm \
  -v "$VOLUME_NAME:/usr/share/nginx" \
  -v "$DIST_DIR:/opt/api-doctor-dist:ro" \
  -e RELEASE_ID="$RELEASE_ID" \
  alpine:3.20 sh -eu -c '
    root=/usr/share/nginx
    release="$root/.oss-releases/api-doctor-$RELEASE_ID"
    mkdir -p "$release"
    cp -a /opt/api-doctor-dist/. "$release/"
    [ -s "$release/index.html" ]
    target="$root/api-doctor"
    if [ -L "$target" ]; then
      readlink "$target" > "$release/.previous"
    elif [ -d "$target" ]; then
      previous=".oss-releases/api-doctor-legacy-$RELEASE_ID"
      mv "$target" "$root/$previous"
      printf "%s\n" "$previous" > "$release/.previous"
    fi
    next="$root/.api-doctor.next-$RELEASE_ID"
    ln -s ".oss-releases/api-doctor-$RELEASE_ID" "$next"
    mv -Tf "$next" "$target"
    keep=" api-doctor-$RELEASE_ID "
    if [ -f "$release/.previous" ]; then
      previous="$(cat "$release/.previous")"
      keep="$keep$(basename "$previous") "
    fi
    for directory in "$root/.oss-releases"/api-doctor-*; do
      [ -d "$directory" ] || continue
      name="$(basename "$directory")"
      case "$keep" in
        *" $name "*) ;;
        *) rm -rf -- "$directory" ;;
      esac
    done
    printf "API Doctor activated: %s\n" "$RELEASE_ID"
  '
