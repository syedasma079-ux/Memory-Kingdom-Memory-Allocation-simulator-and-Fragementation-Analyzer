#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <sys/prctl.h>

static volatile sig_atomic_t g_running = 1;

static void sigint_handler(int sig) {
    (void)sig;
    g_running = 0;
    _exit(0);
}

static void sigtstp_handler(int sig) {
    (void)sig;
    /* In non-controlling terminal or background process groups, default SIGTSTP
     * is ignored by the Linux kernel. Raising SIGSTOP explicitly guarantees
     * the process transitions to stopped state and waitpid(..., WUNTRACED) wakes. */
    raise(SIGSTOP);
}

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;

    /* Prevent orphan processes if parent dispatcher terminates */
    prctl(PR_SET_PDEATHSIG, SIGKILL);
    if (getppid() == 1) {
        /* Parent already died before prctl */
        _exit(0);
    }

    /* Signal handlers */
    struct sigaction sa_int;
    sa_int.sa_handler = sigint_handler;
    sigemptyset(&sa_int.sa_mask);
    sa_int.sa_flags = 0;
    sigaction(SIGINT, &sa_int, NULL);

    struct sigaction sa_tstp;
    sa_tstp.sa_handler = sigtstp_handler;
    sigemptyset(&sa_tstp.sa_mask);
    sa_tstp.sa_flags = 0;
    sigaction(SIGTSTP, &sa_tstp, NULL);

    /* Redirect stdout and stderr to /dev/null */
    if (freopen("/dev/null", "w", stdout) == NULL) {}
    if (freopen("/dev/null", "w", stderr) == NULL) {}

    while (g_running) {
        if (getppid() == 1) {
            _exit(0);
        }
        sleep(1);
    }

    return 0;
}
