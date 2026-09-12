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

  const updateTerminatedProcessIds = (workspace) => {
    const runningProcessIds = new Set();
    const runningApplications = workspace.runningApplications;
    for (let index = 0; index < runningApplications.count; index++) {
      runningProcessIds.add(Number(runningApplications.objectAtIndex(index).processIdentifier));
    }

    for (const processId of processIds) {
      if (!runningProcessIds.has(processId)) {
        terminatedProcessIds.add(processId);
      }
    }

    if (terminatedProcessIds.size === processIds.size) {
      stopRunLoop();
    }
  };

  ObjC.registerSubclass({
    name: "ExpoDesktopTerminationObserver",
    superclass: "NSObject",
    methods: {
      "observeValueForKeyPath:ofObject:change:context:": {
        types: ["void", ["id", "id", "id", "void*"]],
        implementation: function (_keyPath, workspace) {
          updateTerminatedProcessIds(workspace);
        },
      },
    },
  });

  const observer = $.ExpoDesktopTerminationObserver.alloc.init;
  const workspace = $.NSWorkspace.sharedWorkspace;
  workspace.addObserverForKeyPathOptionsContext(
    observer,
    "runningApplications",
    $.NSKeyValueObservingOptionNew,
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
    workspace.removeObserverForKeyPath(observer, "runningApplications");
    return;
  }

  for (const application of applications) {
    application.terminate;
  }

  updateTerminatedProcessIds(workspace);
  if (terminatedProcessIds.size < processIds.size) {
    $.CFRunLoopRunInMode($.kCFRunLoopDefaultMode, terminationTimeoutSeconds, false);
  }

  workspace.removeObserverForKeyPath(observer, "runningApplications");

  if (terminatedProcessIds.size < processIds.size) {
    throw new Error(
      `Timed out waiting for ${processIds.size - terminatedProcessIds.size} application instance(s) to terminate.`,
    );
  }
}
