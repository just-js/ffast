#include <string.h>
#include <stdlib.h>

typedef int (*callback)(int i, void* j);

static callback cb;
static int stopped = 1;
static int counter = 0;

void register_callback (callback cba) {
  cb = cba;
}

void start_callbacks () {
  stopped = 0;
  counter = 0;
  while (stopped == 0) counter = cb(counter, 0);
}

void stop_callbacks () {
  stopped = 1;
}

void callback_once () {
  counter = cb(counter, cb);
}

void void_no_args () {

}

void void_one_pointer_arg (void* ptr) {

}

int int32_no_args () {
  return 1;
}

int int32_one_int32_arg (int i) {
  return i + i;
}

int int32_two_int32_args (int i, int j) {
  return i + j;
}

int int32_three_int32_args (int i, int j, int k) {
  return i + j + k;
}

int int32_one_pointer_arg (void* ptr) {
  return 2147483647;
}

int int32_one_string_arg (const char* str) {
  return strnlen(str, 1024);
}

void* pointer_no_args () {
  void* m = malloc(8);
  free(m);
  return 2147483647;
}