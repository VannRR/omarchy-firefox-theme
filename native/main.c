/**
 * @license MIT
 * Copyright 2025 VannRR <https://github.com/vannrr>
 *
 * see the LICENSE file for details
 */

#define _DEFAULT_SOURCE

#include <dirent.h>
#include <endian.h>
#include <errno.h>
#include <fcntl.h>
#include <pwd.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <unistd.h>

#define CHROMIUM_THEME_MAX 12 // 11 chars + NUL for "255,255,255"
#define STRING_MAX 256
#define MSG_MAX 512
#define INOTIFY_BUF_LEN 4096
#define CURRENT_PATH_FMT "%s/.config/omarchy/current"
#define CHROMIUM_THEME_PATH_FMT "%s/theme/chromium.theme"
#define THEME_DIR "theme"

static char msg[MSG_MAX];
static char esc_err[MSG_MAX];
static char esc_syserr[MSG_MAX];

static int notify_fd = -1;
static void clean_exit(const int err) {
  if (notify_fd >= 0) {
    close(notify_fd);
  }
  exit(err);
}

/*
 * Escapes `src` (length src_len) into `dst` (size dst_size).
 * Returns number of bytes written (excluding NUL) or -1 if dst was too small.
 *
 * dst_size must include space for the terminating NUL.
 */
static ssize_t json_escape(const char *src, size_t src_len, char *dst,
                           size_t dst_size) {
  if (!src || !dst || dst_size == 0)
    return -1;
  size_t si = 0, di = 0;
  static const char hex[] = "0123456789abcdef";

  while (si < src_len) {
    unsigned char c = (unsigned char)src[si++];

    /* worst-case expansion: \u00XX -> 6 bytes, ensure space conservatively */
    if (di + 6 >= dst_size)
      return -1;

    switch (c) {
    case '\"':
      dst[di++] = '\\';
      dst[di++] = '\"';
      break;
    case '\\':
      dst[di++] = '\\';
      dst[di++] = '\\';
      break;
    case '\b':
      dst[di++] = '\\';
      dst[di++] = 'b';
      break;
    case '\f':
      dst[di++] = '\\';
      dst[di++] = 'f';
      break;
    case '\n':
      dst[di++] = '\\';
      dst[di++] = 'n';
      break;
    case '\r':
      dst[di++] = '\\';
      dst[di++] = 'r';
      break;
    case '\t':
      dst[di++] = '\\';
      dst[di++] = 't';
      break;
    default:
      if (c < 0x20) {
        dst[di++] = '\\';
        dst[di++] = 'u';
        dst[di++] = '0';
        dst[di++] = '0';
        dst[di++] = hex[(c >> 4) & 0xF];
        dst[di++] = hex[c & 0xF];
      } else {
        dst[di++] = (char)c;
      }
    }
  }

  if (di >= dst_size)
    return -1;
  dst[di] = '\0';
  return (ssize_t)di;
}

// Write formatted string into s (capacity maxlen).
// Return 0 on success, ERANGE if truncated, or other errno-style nonzero on
// error.
static int snprintf_werr(char *s, size_t maxlen, const char *format, ...) {
  if (s == NULL || maxlen == 0 || format == NULL)
    return EINVAL;

  va_list ap;
  va_start(ap, format);
  int needed = vsnprintf(s, maxlen, format, ap);
  va_end(ap);

  if (needed < 0) {
    return EIO;
  }

  if ((size_t)needed >= maxlen) {
    return ERANGE;
  }

  return 0;
}

// send json message to stdout with preceding unsigned 32-bit value containing
// the message length in native byte order.
// `{ rgb: [number,number,number] | null, error: string | null }`
static void send_msg(const char *rgb, const char *err, int en) {
  esc_err[0] = '\0';
  esc_syserr[0] = '\0';
  msg[0] = '\0';

  const char *syserr = (err != NULL) ? strerror(en) : NULL;

  if (err != NULL) {
    ssize_t r = json_escape(err, strlen(err), esc_err, sizeof(esc_err));
    if (r < 0) {
      snprintf(esc_err, sizeof(esc_err), "error too long");
      esc_err[sizeof(esc_err) - 1] = '\0';
    }
  }

  if (syserr != NULL) {
    ssize_t r2 =
        json_escape(syserr, strlen(syserr), esc_syserr, sizeof(esc_syserr));
    if (r2 < 0) {
      snprintf(esc_syserr, sizeof(esc_syserr), "error too long");
      esc_syserr[sizeof(esc_syserr) - 1] = '\0';
    }
  }

  int ret = 1;
  if (rgb != NULL && err != NULL) {
    ret = snprintf_werr(msg, MSG_MAX, "{\"rgb\":[%s],\"error\":\"%s: %s\"}",
                        rgb, esc_err, esc_syserr);
  } else if (rgb != NULL && err == NULL) {
    ret = snprintf_werr(msg, MSG_MAX, "{\"rgb\":[%s],\"error\":null}", rgb);
  } else if (rgb == NULL && err != NULL) {
    ret = snprintf_werr(msg, MSG_MAX, "{\"rgb\":null,\"error\":\"%s: %s\"}",
                        esc_err, esc_syserr);
  } else {
    ret = snprintf_werr(msg, MSG_MAX, "{\"rgb\":null,\"error\":null}");
  }

  if (ret != 0) {
    fprintf(stderr, "could not send message: %s\n", strerror(ret));
    return;
  }

  uint32_t len = (uint32_t)strlen(msg);
  uint32_t len_le = htole32(len);
  if (fwrite(&len_le, sizeof(len_le), 1, stdout) != 1) {
    fprintf(stderr, "could not send message: %s\n", strerror(errno));
    return;
  }
  if (fwrite(msg, 1, len, stdout) != len) {
    fprintf(stderr, "could not send message: %s\n", strerror(errno));
    return;
  }

  fflush(stdout);
}

static int dir_exists(const char *path) {
  DIR *dir = opendir(path);
  if (dir) {
    closedir(dir);
    return 0;
  } else {
    return errno;
  }
}

static int file_exists(const char *path) {
  FILE *file = fopen(path, "r");
  if (file) {
    fclose(file);
    return 0;
  } else {
    return errno;
  }
}

// get user home directory (intended for linux)
static int get_home(char *home) {
  char *h = getenv("HOME");
  if (h != NULL) {
    return snprintf_werr(home, STRING_MAX, "%s", h);
  }

  struct passwd *pw = getpwuid(getuid());
  if (pw == NULL)
    return errno;

  return snprintf_werr(home, STRING_MAX, "%s", pw->pw_dir);
}

// current_path = `~/.config/omarchy/current`
static int get_current_path(char *current_path) {
  char home[STRING_MAX];
  int res = get_home(home);
  if (res != 0) {
    return res;
  }

  int ret = snprintf_werr(current_path, STRING_MAX, CURRENT_PATH_FMT, home);
  if (ret != 0) {
    return ret;
  }

  return dir_exists(current_path);
}

// chromium_theme_path = `~/.config/omarchy/current/theme/chromium.theme`
static int get_chromium_theme_path(char *chromium_theme_path,
                                   const char *current_path) {
  int ret = snprintf_werr(chromium_theme_path, STRING_MAX,
                          CHROMIUM_THEME_PATH_FMT, current_path);
  if (ret != 0) {
    return ret;
  }

  return file_exists(chromium_theme_path);
}

// read chromium.theme to string. expect 0..255,0..255,0..255
static int get_chromium_theme(char *chromium_theme,
                              const char *chromium_theme_path) {
  FILE *file = fopen(chromium_theme_path, "r");
  if (!file) {
    return errno;
  }

  char line[STRING_MAX];
  if (!fgets(line, sizeof(line), file)) {
    fclose(file);
    return errno;
  }
  fclose(file);

  int j = 0;
  for (int i = 0; i < STRING_MAX; i++) {
    char c = line[i];
    if (c == '\0') {
      break;
    }
    if ((c >= '0' && c <= '9') || c == ',') {
      if (j >= CHROMIUM_THEME_MAX - 1) {
        break;
      }
      chromium_theme[j++] = c;
    }
  }
  chromium_theme[j] = '\0';

  return 0;
}

int main(void) {
  static int result = 0;

  static char current_path[STRING_MAX];
  result = get_current_path(current_path);
  if (result != 0) {
    send_msg(NULL, "could not get path '~/.config/omarchy/current'", result);
    clean_exit(result);
  }

  notify_fd = inotify_init();
  if (notify_fd == -1) {
    send_msg(NULL, "could not init inotify", errno);
    clean_exit(errno);
  }

  if (inotify_add_watch(notify_fd, current_path, IN_MOVED_TO) == -1) {
    send_msg(NULL, "could not watch directory '~/.config/omarchy/current'",
             errno);
    clean_exit(errno);
  }

  static char chromium_theme_path[STRING_MAX];
  result = get_chromium_theme_path(chromium_theme_path, current_path);
  if (result != 0) {
    send_msg(
        NULL,
        "could not get path '~/.config/omarchy/current/theme/chromium.theme'",
        result);
    clean_exit(result);
  }

  static char chromium_theme[CHROMIUM_THEME_MAX];
  result = get_chromium_theme(chromium_theme, chromium_theme_path);
  if (result != 0) {
    send_msg(NULL, "could not read chromium.theme to string", result);
    clean_exit(result);
  }

  send_msg(chromium_theme, NULL, 0);

  char buf[INOTIFY_BUF_LEN];
  while (1) {
    ssize_t n = read(notify_fd, buf, sizeof(buf));
    if (n == -1) {
      if (errno == EINTR) {
        continue;
      }
      send_msg(NULL, "could not read inotify instance", errno);
      clean_exit(errno);
    }
    if (n == 0) {
      continue;
    }

    for (ssize_t off = 0; off < n;) {
      struct inotify_event *ev = (struct inotify_event *)(buf + off);
      size_t ev_size = sizeof(struct inotify_event) + ev->len;
      if (ev_size == 0 || off + ev_size > (size_t)n) {
        break;
      }

      if ((ev->mask & (IN_MOVED_TO | IN_CREATE)) && ev->len > 0 &&
          strcmp(ev->name, THEME_DIR) == 0) {
        result = get_chromium_theme(chromium_theme, chromium_theme_path);
        if (result != 0) {
          send_msg(NULL, "could not read chromium.theme to string", result);
          clean_exit(result);
        }
        send_msg(chromium_theme, NULL, 0);
      }

      off += ev_size;
    }
  }
}
