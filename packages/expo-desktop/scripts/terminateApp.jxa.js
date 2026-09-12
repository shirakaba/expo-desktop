ObjC.import("AppKit");
ObjC.import("Foundation");

function run(argv) {
  const bundleIdentifier = argv[0];
  if (!bundleIdentifier) {
    throw new Error("Expected an application bundle identifier.");
  }
  const terminationTimeoutSecondsArg = argv[1];
  if (!terminationTimeoutSecondsArg) {
    throw new Error("Expected a termination timeout to be given.");
  }
  const terminationTimeoutSeconds = parseInt(terminationTimeoutSecondsArg);
  if (isNaN(terminationTimeoutSeconds) || terminationTimeoutSeconds <= 0) {
    throw new Error("Expected termination timeout to be a number above 0.");
  }

  const processIds = new Set();
  const terminatedProcessIds = new Set();
  const stopRunLoop = () => {
    $.CFRunLoopStop($.CFRunLoopGetCurrent());
  };

  ObjC.registerSubclass({
    name: "ExpoDesktopTerminationObserver",
    superclass: "NSObject",
    methods: {
      "applicationTerminated:": {
        types: ["void", ["id"]],
        implementation: function (notification) {
          const application = notification.userInfo.objectForKey($.NSWorkspaceApplicationKey);
          const processId = Number(application.processIdentifier);
          if (processIds.has(processId)) {
            terminatedProcessIds.add(processId);
            if (terminatedProcessIds.size === processIds.size) {
              stopRunLoop();
            }
          }
        },
      },
    },
  });

  const observer = $.ExpoDesktopTerminationObserver.alloc.init;
  const workspace = $.NSWorkspace.sharedWorkspace;
  const notificationCenter = workspace.notificationCenter;
  const applicationTerminatedSelector = $.NSSelectorFromString("applicationTerminated:");

  notificationCenter.addObserverSelectorNameObject(
    observer,
    applicationTerminatedSelector,
    $.NSWorkspaceDidTerminateApplicationNotification,
    null,
  );

  const runningApplications =
    $.NSRunningApplication.runningApplicationsWithBundleIdentifier(bundleIdentifier);
  const applications = [];
  for (let index = 0; index < runningApplications.count; index++) {
    const application = runningApplications.objectAtIndex(index);
    applications.push(application);
    processIds.add(Number(application.processIdentifier));
  }

  if (applications.length === 0) {
    notificationCenter.removeObserver(observer);
    return;
  }

  for (const application of applications) {
    application.terminate();
  }

  if (terminatedProcessIds.size < processIds.size) {
    $.CFRunLoopRunInMode($.kCFRunLoopDefaultMode, terminationTimeoutSeconds, false);
  }

  notificationCenter.removeObserver(observer);

  if (terminatedProcessIds.size < processIds.size) {
    throw new Error(
      `Timed out waiting for ${processIds.size - terminatedProcessIds.size} application instance(s) to terminate.`,
    );
  }
}
