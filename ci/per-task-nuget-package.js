// Overview:
// 
// This script starts with having a folder per task with the content for each task inside(comes from combining the slices).
// First we need to copy this to a per-task-layout folder. Once we can remove the aggregate
//  code this process can be cleaned up. We can remove slicing probably and the like.
// We start by adding a .nuspec file for each task inside the task folder.
// Then we iterate each of these tasks and create a .nupkg and push.cmd per task.
// 
// Folder structure:
// 
// _package
//  /per-task-layout (util.perTaskLayoutPath)
//      /CmdLineV2__v2 // Keep "__v2" this until everyone has version in their task name.
//          /Strings
//          /task.json
//          /task.loc.json
//          /task.zip
//          /{task name and info}.nuspec *created in this script
// 
//  /per-task-publish (util.perTaskPublishPath)
//      /CmdLineV2__v2 //  Keep "__v2" this until everyone has version in their task name.
//          Mseng.MS.TF.Build.Tasks.CmdLineV2.2.132.0.nupkg *created in this script, think this is actually .nuspec, TODO: Remove V2 from task name.... no need
//          push.cmd *created in this script
//      push-all.cmd (courtesy script that runs all push.cmds, we will run this once a sprint and force a build all) TODO: Create this.
// 
// Notes:
// 
// Currently the code works within the legacy setup of having multiple slices that are pushed as artifacts and then recombined.
// Once this code is live for a while we will remove that legacy code and it should simplify the setup here. We can use the original 
//    build folders for each task in place of the per-task-layout.

var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('./ci-util');

// TODO: Make a helper method, create directory if doesn't exist? Also do this when we create files? If a folder doesn't exist then create it?

// build only what's changed, do that later. It happens upstream anyways, not here.
var localRun = false;

const listFilesInDirectory = dir =>
        fs.readdirSync(dir).reduce((files, file) => {
            const name = path.join(dir, file);
            const isDirectory = fs.statSync(name).isDirectory();
            return isDirectory ? [...files, ...listFilesInDirectory(name)] : [...files, name];
        }, []);

// If this flag is set we want to stage the per task nuget files.
// After this is fully working we can refactor again and clean up all the aggregate code.
// Trying to make this code change in such a way that we only need to delete aggregate 
//      files later and not redo any of the nuget package per task code.
if (process.env.DISTRIBUTEDTASK_USE_PERTASK_NUGET || localRun) {
    console.log('> Creating nuget package per task');

    if (localRun) {
        var layoutPath = 'E:\\github\\vsts-tasks\\_build\\Tasks'; // This is the folder where the built tasks live.
        var publishPath = 'E:\\github\\vsts-tasks\\_build\\Publish'; // This is the folder that we publish.
    }
    else {
        // Settings when running on the server
        var layoutPath = util.perTaskLayoutPath;
        var publishPath = util.perTaskPublishPath;
    }

    if (!localRun) {
        console.log('> printing folder structure before starting');

        listFilesInDirectory(util.packagePath).forEach(function (f) { 
            console.log(f);
        });
    }

    if (!localRun) {
        console.log(`> Creating folders for layout '${layoutPath}' and publish '${publishPath}'`);
        
        fs.mkdirSync(layoutPath);
        fs.mkdirSync(publishPath);
    }

    if (localRun) {
        console.log('Running locally, skipping aggregate layout content linking');
    }
    else {
        // TODO: I think we need to make changes here but start with this and see where it goes.
        // console.log('> Linking aggregate layout content to per-task-layout path, may need to change this');
        // //var commitHash = refs.head.commit;

        var commitHash = 'aaaaaa';
        var taskDestMap = {}; // I don't think this is actually used for anything?
        util.linkAggregateLayoutContent(util.milestoneLayoutPath, layoutPath, '', commitHash, taskDestMap);

        listFilesInDirectory(util.packagePath).forEach(function (f) { 
            console.log(f);
        });
    }

    console.log();
    console.log(`> Iterating all folders in '${layoutPath}'`);
    fs.readdirSync(layoutPath)
        .forEach(function (taskFolderName) {
            if (taskFolderName.indexOf('aaaaaa') > -1) {
                // For some reason there is also D:\a\1\s\_package\per-task-layout\AzurePowerShellV3__v3_aaaaaa
                return;
            }

            var taskLayoutPath = path.join(layoutPath, taskFolderName); // e.g. - _package\per-task-layout\AzurePowerShellV3__v3. For some reason there is also D:\a\1\s\_package\per-task-layout\AzurePowerShellV3__v3_aaaaaa
            // console.log();
            // console.log('> Task path exists: ' + fs.existsSync(taskLayoutPath));
            // console.log('> Task path: ' + taskLayoutPath);

            // load the task.json
            var taskJsonPath = path.join(taskLayoutPath, 'task.json');
            var taskJsonContents = JSON.parse(fs.readFileSync(taskJsonPath));

            // extract values that we need from task.json
            var taskVersion = taskJsonContents.version.Major + '.' + taskJsonContents.version.Minor + '.' + taskJsonContents.version.Patch;
            var taskName = taskJsonContents.name; // e.g - AzureCLI
            var fullTaskName = 'Mseng.MS.TF.Build.Tasks.' + taskName; // e.g. - Mseng.MS.TF.Build.Tasks.AzureCLI

            var taskNuspecPath = createNuspecFile(taskLayoutPath, fullTaskName, taskVersion);
            var taskPublishFolder = createNuGetPackage(publishPath, taskFolderName, taskNuspecPath, taskLayoutPath);
            createPushCmd(taskPublishFolder, fullTaskName, taskVersion);
        });


    if (!localRun) {
        console.log('> Finished, printing package folder contents.');
        listFilesInDirectory(util.packagePath).forEach(function (f) { 
            console.log(f);
        });
    }
}

/**
 * Create .nuspec file for the task.
 * @param {*} taskLayoutPath Layout path for the specific task we are creating nuspec for. e.g. - _package\per-task-layout\AzurePowerShellV3__v3
 * @param {*} fullTaskName Full name of the task. e.g - AzureCLIV2
 * @param {*} taskVersion taskVersion Version of the task. e.g - 1.132.0
 * @returns Path of the nuspec file that was created.
 */
function createNuspecFile(taskLayoutPath, fullTaskName, taskVersion) {
    console.log('> Creating nuspec file');
    
    var contents = '<?xml version="1.0" encoding="utf-8"?>' + os.EOL;
    contents += '<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">' + os.EOL;
    contents += '   <metadata>' + os.EOL;
    contents += '      <id>' + fullTaskName + '</id>' + os.EOL;
    contents += '      <version>' + taskVersion + '</version>' + os.EOL;
    contents += '      <authors>bigbldt</authors>' + os.EOL;
    contents += '      <owners>bigbldt,Microsoft</owners>' + os.EOL;
    contents += '      <requireLicenseAcceptance>false</requireLicenseAcceptance>' + os.EOL;
    contents += '      <description>For VSS internal use only</description>' + os.EOL;
    contents += '      <tags>VSSInternal</tags>' + os.EOL;
    contents += '   </metadata>' + os.EOL;
    contents += '</package>' + os.EOL;

    // Careful, what about major version in folder names? Need to parse task.json and use that.... maybe
    var taskNuspecPath = path.join(taskLayoutPath, fullTaskName + '.nuspec'); // e.g. - _package\per-task-layout\AzureCLIV1__v1\Mseng.MS.TF.Build.Tasks.AzureCLIV1__v1.nuspec. TODO: This this sample accurate?
    console.log('taskNuspecPath: ' + taskNuspecPath);
    fs.writeFileSync(taskNuspecPath, contents);

    return taskNuspecPath;
}

/**
 * Create .nupkg for a specific task.
 * @param {*} publishPath X. e.g - 
 * @param {*} taskFolderName X. e.g - 
 * @param {*} taskNuspecPath X. e.g - 
 * @param {*} taskLayoutFolder X. e.g - 
 * @returns Publish folder for the task. e.g - D:\a\1\s\_package\per-task-publish
 */
function createNuGetPackage(publishPath, taskFolderName, taskNuspecPath, taskLayoutFolder) {
    console.log('> Creating nuget package for task ' + taskFolderName);
    var taskPublishFolder = path.join(publishPath, taskFolderName);

    fs.mkdirSync(taskPublishFolder); // make the folder that we will publish, publish-per-task
    process.chdir(taskPublishFolder);
    util.run(`nuget pack "${taskNuspecPath}" -BasePath "${taskLayoutFolder}" -NoDefaultExcludes`, /*inheritStreams:*/true);

    return taskPublishFolder;
}

/**
 * Create push.cmd for the task.
 * @param {*} taskPublishFolder Folder where we are publishing tasks from. e.g - D:\a\1\s\_package\per-task-publish\AzureCLIV1__v1
 * @param {*} fullTaskName Full name of the task. e.g - Mseng.MS.TF.Build.Tasks.AzureCLI
 * @param {*} taskVersion Version of the task. e.g - 1.132.0
 */
function createPushCmd(taskPublishFolder, fullTaskName, taskVersion) {
    console.log('> Creating push.cmd for task ' + taskName);

    var taskPushCmdPath = path.join(taskPublishFolder, 'push.cmd');
    var nupkgName = `${fullTaskName}.${taskVersion}.nupkg`;

    // Settings when running locally
    if (localRun) {
        var taskFeedUrl = 'http://localhost:44396/'; // plus something? package name per task? maybe we need the base task feed url then we dynamically update based on task name? or specify it in task.json?
        var apiKey = '123456';
    }
    else {
        // Settings when running on the server
        var taskFeedUrl = process.env.AGGREGATE_TASKS_FEED_URL; // Need the task feed per task. This is based on task name from task.json too.
        var apiKey = 'Skyrise';
    }
    
    fs.writeFileSync(taskPushCmdPath, `nuget.exe push ${nupkgName} -source "${taskFeedUrl}" -apikey ${apiKey}`);
}

